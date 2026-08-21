// ============================================
// 관리자 — 회원 활동 통계 (/admin/users 상단 블록)
//
// /admin/stats 와 역할 분리:
//   - /admin/stats  = 카드·트래픽 관점 (어떤 카드가 눌리나, 어느 자리가 잘 되나)
//   - 여기          = 사람 관점 (가입은 느나, 온보딩을 끝내나, 다시 오나)
//
// ⚠️ 모든 "방문/활동"은 events 기준이다. `last_sign_in_at`(인증)으로 세면
//    세션이 유지된 활동 회원이 통째로 휴면으로 잡힌다 (AdminUserRow 주석 참고).
// ⚠️ events는 현재 클릭·필터·검색만 기록 → "열어보기만 한 방문"은 미포착.
//    따라서 재방문율·리텐션은 모두 **과소 추정**이다 (app_open 이벤트 추가 후 해소).
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import { fetchAllRows } from "@/shared/db/fetch-all-rows";
import { kstDayKey, kstWeekKey } from "@/shared/utils/dday";

const DAY_MS = 24 * 60 * 60 * 1000;
/** 코호트 표에 보여줄 최근 가입 주차 수 */
const COHORT_WEEKS = 8;
/** 코호트 가로축 — W0(가입주) ~ W4 */
const COHORT_SPAN = 5;

export interface CohortRow {
  /** 가입 주 시작일 (KST 월요일) */
  week: string;
  /** 그 주 가입자 수 */
  size: number;
  /**
   * W0~W4 잔존 수. `null`이면 **아직 그 주차가 도래하지 않음**(측정 불가) —
   * 0(=아무도 안 옴)과 구분해야 한다. 이걸 섞으면 최근 코호트가 실패로 오독된다.
   */
  retained: Array<number | null>;
}

export interface MemberStats {
  /** 전체 회원 수 */
  total: number;
  /** 자녀 등록까지 끝낸 회원 (온보딩 완료) */
  withChildren: number;
  /** 푸시 구독 회원 */
  withPush: number;
  /** 최근 7일 / 30일 내 방문(events)한 회원 */
  active7: number;
  active30: number;
  /** 가입일 외 다른 날에도 활동한 적 있는 회원 = 재방문 */
  returning: number;
  /** 한 번도 활동 기록이 없는 회원 (가입만 하고 이탈) */
  neverActive: number;
  /** 최근 30일 활동일수 분포 */
  activeDaysDist: { d0: number; d1: number; d2to3: number; d4to7: number; d8plus: number };
  /** 로그인 수단 분포 */
  providerMix: Array<{ provider: string; count: number }>;
  /** 주별 신규 가입 (최근 COHORT_WEEKS주) */
  signupByWeek: Array<{ week: string; count: number }>;
  /** 가입 주차별 코호트 리텐션 */
  cohorts: CohortRow[];
  /**
   * 방문 → 가입 전환 (최근 30일).
   * 분모는 익명 방문자(anon_id 고유 수), 분자는 그 기간 신규 가입자 수.
   * ⚠️ anon_id는 브라우저·PWA·TWA마다 따로 생겨 분모가 부풀어 있다 → 전환율은 **하한**.
   */
  conversion: { anonVisitors30d: number; newMembers30d: number; rate: number };
}

/** auth.users 전량 (페이지 루프 — listUsers는 perPage 상한이 있음) */
async function fetchAllAuthUsers() {
  const perPage = 200;
  const all: Array<{
    id: string;
    created_at: string;
    identities?: Array<{ provider: string }> | null;
  }> = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`fetchAllAuthUsers: ${error.message}`);
    const batch = data.users ?? [];
    all.push(
      ...batch.map((u) => ({
        id: u.id,
        created_at: u.created_at,
        identities: u.identities ?? null,
      }))
    );
    if (batch.length < perPage) break;
  }
  return all;
}

export async function getMemberStats(): Promise<MemberStats> {
  const now = Date.now();
  const since90 = new Date(now - 90 * DAY_MS).toISOString();

  const [users, childRows, pushRows, eventRows] = await Promise.all([
    fetchAllAuthUsers(),
    fetchAllRows<{ user_id: string }>("memberStats.children", (from, to) =>
      supabaseServer.from("children").select("user_id").order("id", { ascending: true }).range(from, to)
    ),
    fetchAllRows<{ user_id: string }>("memberStats.push", (from, to) =>
      supabaseServer
        .from("push_subscriptions")
        .select("user_id")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    // 회원 활동 + 익명 방문자(전환율 분모) 둘 다 필요 → user_id 필터 없이 기간만
    fetchAllRows<{ user_id: string | null; anon_id: string | null; created_at: string }>(
      "memberStats.events",
      (from, to) =>
        supabaseServer
          .from("events")
          .select("user_id, anon_id, created_at")
          .gte("created_at", since90)
          .order("id", { ascending: true })
          .range(from, to)
    ),
  ]);

  const childSet = new Set(childRows.map((r) => r.user_id));
  const pushSet = new Set(pushRows.map((r) => r.user_id));

  // 회원별 활동일(KST) 집합
  const activeDays = new Map<string, Set<string>>();
  for (const ev of eventRows) {
    if (!ev.user_id) continue;
    const set = activeDays.get(ev.user_id) ?? new Set<string>();
    set.add(kstDayKey(ev.created_at));
    activeDays.set(ev.user_id, set);
  }

  let active7 = 0;
  let active30 = 0;
  let returning = 0;
  let neverActive = 0;
  const dist = { d0: 0, d1: 0, d2to3: 0, d4to7: 0, d8plus: 0 };

  const day7 = kstDayKey(new Date(now - 7 * DAY_MS));
  const day30 = kstDayKey(new Date(now - 30 * DAY_MS));

  for (const u of users) {
    const days = activeDays.get(u.id);
    if (!days || days.size === 0) {
      neverActive++;
      dist.d0++;
      continue;
    }
    const sorted = [...days].sort();
    if (sorted.some((d) => d >= day7)) active7++;
    const in30 = sorted.filter((d) => d >= day30);
    if (in30.length > 0) active30++;

    // 재방문 = 가입일이 아닌 날에도 활동한 적 있음
    const signupDay = kstDayKey(u.created_at);
    if (sorted.some((d) => d !== signupDay)) returning++;

    const n = in30.length;
    if (n === 0) dist.d0++;
    else if (n === 1) dist.d1++;
    else if (n <= 3) dist.d2to3++;
    else if (n <= 7) dist.d4to7++;
    else dist.d8plus++;
  }

  // 로그인 수단
  const providerCount = new Map<string, number>();
  for (const u of users) {
    const provs = new Set((u.identities ?? []).map((i) => i.provider));
    if (provs.size === 0) provs.add("email");
    for (const p of provs) providerCount.set(p, (providerCount.get(p) ?? 0) + 1);
  }

  // 주별 가입 + 코호트
  const byWeek = new Map<string, string[]>(); // week -> userIds
  for (const u of users) {
    const w = kstWeekKey(u.created_at);
    const arr = byWeek.get(w) ?? [];
    arr.push(u.id);
    byWeek.set(w, arr);
  }
  const weeks = [...byWeek.keys()].sort().slice(-COHORT_WEEKS);

  const signupByWeek = weeks.map((w) => ({ week: w, count: byWeek.get(w)!.length }));

  const cohorts: CohortRow[] = weeks.map((w) => {
    const ids = byWeek.get(w)!;
    const weekStartMs = Date.parse(`${w}T00:00:00+09:00`);
    const retained: Array<number | null> = [];
    for (let k = 0; k < COHORT_SPAN; k++) {
      const winStart = weekStartMs + k * 7 * DAY_MS;
      const winEnd = winStart + 7 * DAY_MS;
      // 그 주차가 아직 시작도 안 했으면 측정 불가(null) — 0과 구분
      if (winStart > now) {
        retained.push(null);
        continue;
      }
      const from = kstDayKey(new Date(winStart));
      const to = kstDayKey(new Date(winEnd - 1));
      const n = ids.filter((id) => {
        const days = activeDays.get(id);
        if (!days) return false;
        for (const d of days) if (d >= from && d <= to) return true;
        return false;
      }).length;
      retained.push(n);
    }
    return { week: w, size: ids.length, retained };
  });

  // 방문 → 가입 전환 (최근 30일)
  const since30Iso = new Date(now - 30 * DAY_MS).toISOString();
  const anonVisitors = new Set(
    eventRows.filter((e) => !e.user_id && e.anon_id && e.created_at >= since30Iso).map((e) => e.anon_id!)
  );
  const newMembers30d = users.filter((u) => u.created_at >= since30Iso).length;
  const denom = anonVisitors.size + newMembers30d;

  return {
    total: users.length,
    withChildren: users.filter((u) => childSet.has(u.id)).length,
    withPush: users.filter((u) => pushSet.has(u.id)).length,
    active7,
    active30,
    returning,
    neverActive,
    activeDaysDist: dist,
    providerMix: [...providerCount.entries()]
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count),
    signupByWeek,
    cohorts,
    conversion: {
      anonVisitors30d: anonVisitors.size,
      newMembers30d,
      rate: denom > 0 ? newMembers30d / denom : 0,
    },
  };
}

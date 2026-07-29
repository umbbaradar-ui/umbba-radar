"use client";

// ============================================
// HomeView — 홈 (마이레이더 존 + 엄빠레이더 추천 존)
// 2026-07 홈 개편: 단일 그리드+필터 4행 → 2존 섹션형 홈.
// 전체 그리드·검색·필터는 /explore 로 분리.
//
// 구조 (위→아래):
//   [검색바(→/explore)] [AdSlot top_banner]
//   존 A 📡 마이레이더 (rose 그라데이션, 로그인 상태별 분기)
//     1. 오늘의 레이더 브리핑 — 히어로 + 스탯 칩(앵커 스크롤)
//     2. 마감 레이더 — 관심→내 아이→전체 3단 폴백, 컴팩트 리스트
//     3. 요즘 키워드 모아보기 — 프리셋 키워드 실시간 매칭 레일
//     4. 우리 아이 시기, 새로 뜬 혜택 — 캐러셀 (미등록자는 유도/티저)
//   존 B 🐻 엄빠레이더 추천 (전 상태 동일)
//     5. 추천 픽 — pinned_until 우선 + 신규 채움
//     6. 마감미정 혜택 — deadline NULL 전용 선반 (0건이면 숨김)
//     7. 시기별로 둘러보기 — 허브 칩 그리드
//   [전체 탐색 CTA]
//
// 데이터는 현 규모(발행 ≤300건) 전량 1회 로드 + 인메모리 계산.
// 발행 1,000건 도달 시 섹션별 쿼리 분리로 전환할 것.
//
// previewMode 지정 시(/test 미리보기 페이지) 상단에 상태 스위처 노출.
// ============================================

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Post, StageCategory } from "@/shared/types/post";
import { STAGE_LABELS } from "@/shared/types/post";
import { PostCard } from "@/modules/content/ui/PostCard";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";
import { calcDDay } from "@/shared/utils/dday";
import {
  listUserPostStatuses,
  subscribe,
  type UserPostStatusValue,
} from "@/modules/personalization/service";

interface Props {
  posts: Post[];
  loggedIn: boolean;
  hasChildren: boolean;
  myChildStages: StageCategory[];
  statusMap: Record<string, UserPostStatusValue>;
  todayStartIso: string;
  /** /test 미리보기 페이지에서만 지정 — 상태 스위처 노출 */
  previewMode?: "real" | "guest" | "member";
}

// ── 키워드 매칭 ────────────────────────────────
// 프리셋 키워드를 실데이터에 실시간 매칭하는 큐레이션 레일.
// (개인 키워드 등록·알림은 user_keywords 마이그레이션과 함께 후속 —
//  그때 matchKeyword를 personalization/keyword-matching.ts 순수함수로 분리해
//  홈·알림·푸시가 공유하도록 승격)

const KEYWORD_WINDOW_DAYS = 14;

const PRESET_KEYWORDS = [
  "유모차",
  "카시트",
  "기저귀",
  "이유식",
  "물티슈",
  "아기띠",
  "장난감",
  "젖병",
  "분유",
  "내복",
];

function normKw(s: string): string {
  return s.toLowerCase().normalize("NFKC").replace(/[\s.·\-_/|,]/g, "");
}

function matchKeyword(post: Post, kw: string): boolean {
  const k = normKw(kw);
  if (k.length < 2) return false;
  const strong = [
    post.title,
    post.brand_name ?? "",
    post.search_keywords ?? "",
  ];
  if (strong.some((f) => normKw(f).includes(k))) return true;
  if (k.length >= 3 && post.body) return normKw(post.body).includes(k);
  return false;
}

// ── 시기 허브 아이콘 ───────────────────────────

const STAGE_ICONS: Record<StageCategory, string> = {
  pregnancy: "🤰",
  newborn: "👶",
  infant: "🍼",
  toddler: "🧸",
  elementary: "🎒",
  all_ages: "👨‍👩‍👧",
};

const HUB_STAGES: StageCategory[] = [
  "pregnancy",
  "newborn",
  "infant",
  "toddler",
  "elementary",
  "all_ages",
];

export function HomeView({
  posts,
  loggedIn,
  hasChildren,
  myChildStages,
  statusMap: serverStatusMap,
  todayStartIso,
  previewMode,
}: Props) {
  // 체크 상태 — 로그인: 서버 맵, 비로그인: localStorage (기존 그리드와 동일 패턴)
  const [statusMap, setStatusMap] = useState(serverStatusMap);
  const [statusHydrated, setStatusHydrated] = useState(loggedIn);

  useEffect(() => {
    if (loggedIn) {
      setStatusHydrated(true);
      return;
    }
    setStatusMap(listUserPostStatuses());
    setStatusHydrated(true);
    const unsub = subscribe(() => setStatusMap(listUserPostStatuses()));
    return unsub;
  }, [loggedIn]);

  const now = Date.now();
  const windowStartMs = now - KEYWORD_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // 1. 히어로 스탯 (기존 오늘의 스캔 배너 로직 확장)
  const scan = useMemo(() => {
    const matching = hasChildren
      ? posts.filter(
          (p) =>
            myChildStages.some((s) => p.stage_categories.includes(s)) ||
            p.stage_categories.includes("all_ages")
        )
      : posts;
    return {
      newToday: matching.filter((p) => p.created_at >= todayStartIso).length,
      matchingTotal: matching.length,
      closingToday: matching.filter((p) => {
        if (p.deadline_unknown) return false;
        const d = calcDDay(p.deadline);
        return d !== null && d.days === 0;
      }).length,
    };
  }, [posts, hasChildren, myChildStages, todayStartIso]);

  // 2. 마감 레이더 — ① 내 관심 D-3 → ② 내 아이 시기 D-3 → ③ 전체 D-3
  const deadlineRadar = useMemo(() => {
    const withinD3 = (p: Post, allowUnknown: boolean) => {
      if (p.deadline_unknown && !allowUnknown) return false;
      const d = calcDDay(p.deadline);
      return d !== null && d.days >= 0 && d.days <= 3;
    };
    const byDeadline = (a: Post, b: Post) =>
      (calcDDay(a.deadline)?.days ?? 99) - (calcDDay(b.deadline)?.days ?? 99);

    const interested = statusHydrated
      ? posts
          .filter(
            (p) => statusMap[p.id] === "interested" && withinD3(p, true)
          )
          .sort(byDeadline)
      : [];
    if (interested.length > 0)
      return { items: interested.slice(0, 3), source: "interested" as const };

    if (myChildStages.length > 0) {
      const mine = posts
        .filter(
          (p) =>
            withinD3(p, false) &&
            p.stage_categories.some((s) => myChildStages.includes(s))
        )
        .sort(byDeadline);
      if (mine.length > 0)
        return { items: mine.slice(0, 3), source: "my_child" as const };
    }

    const all = posts.filter((p) => withinD3(p, false)).sort(byDeadline);
    return { items: all.slice(0, 3), source: "all" as const };
  }, [posts, statusMap, statusHydrated, myChildStages]);

  const interestedCount = useMemo(
    () =>
      statusHydrated
        ? Object.values(statusMap).filter((v) => v === "interested").length
        : 0,
    [statusMap, statusHydrated]
  );

  // 3. 키워드 레일 — 프리셋을 최근 14일 카드에 실시간 매칭
  const keywordData = useMemo(() => {
    const recent = posts.filter(
      (p) => new Date(p.created_at).getTime() >= windowStartMs
    );
    const entries = PRESET_KEYWORDS.map((kw) => ({
      kw,
      matches: recent
        .filter((p) => matchKeyword(p, kw))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }))
      .filter((e) => e.matches.length > 0)
      .sort((a, b) => b.matches.length - a.matches.length)
      .slice(0, 6);
    const total = new Set(entries.flatMap((e) => e.matches.map((m) => m.id)))
      .size;
    return { entries, total };
  }, [posts, windowStartMs]);

  const [selectedKw, setSelectedKw] = useState<string | null>(null);
  const activeKwEntry =
    keywordData.entries.find((e) => e.kw === selectedKw) ??
    keywordData.entries[0];

  // 홈 내 카드 dedup — 위 섹션 우선. 마감 레이더만 중복 허용(놓침 방지 > 중복 회피)
  const usedIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of keywordData.entries) {
      for (const m of e.matches.slice(0, 8)) s.add(m.id);
    }
    return s;
  }, [keywordData]);

  // 4. 우리 아이 시기 신규 — 14일, all_ages 제외(진짜 맞춤만), 최대 8장
  const myChildNew = useMemo(() => {
    if (myChildStages.length === 0) return [];
    return posts
      .filter(
        (p) =>
          new Date(p.created_at).getTime() >= windowStartMs &&
          !usedIds.has(p.id) &&
          p.stage_categories.some(
            (s) => s !== "all_ages" && myChildStages.includes(s)
          )
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8);
  }, [posts, myChildStages, usedIds, windowStartMs]);

  // 비로그인 티저용 — 카드 최다 시기 자동 선정 + 실카드 2장
  const guestStageTeaser = useMemo(() => {
    if (hasChildren) return null;
    const counts = new Map<StageCategory, number>();
    for (const p of posts) {
      for (const s of p.stage_categories) {
        if (s === "all_ages") continue;
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    let best: StageCategory | null = null;
    let bestN = 0;
    for (const [s, n] of counts) {
      if (n > bestN) {
        best = s;
        bestN = n;
      }
    }
    if (!best) return null;
    const cards = posts
      .filter((p) => p.stage_categories.includes(best))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 2);
    return { stage: best, cards };
  }, [posts, hasChildren]);

  const usedIds2 = useMemo(() => {
    const s = new Set(usedIds);
    for (const p of myChildNew) s.add(p.id);
    if (guestStageTeaser) for (const p of guestStageTeaser.cards) s.add(p.id);
    return s;
  }, [usedIds, myChildNew, guestStageTeaser]);

  // 5. 추천 픽 — pinned_until 우선 + 부족분은 최근 신규 중 마감 여유 카드
  const radarPick = useMemo(() => {
    const nowIso = new Date(now).toISOString();
    const pinned = posts.filter(
      (p) => p.pinned_until && p.pinned_until >= nowIso && !usedIds2.has(p.id)
    );
    const fill = posts
      .filter((p) => {
        if (usedIds2.has(p.id) || pinned.includes(p)) return false;
        const d = calcDDay(p.deadline);
        return d === null || d.days >= 4;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      items: [...pinned, ...fill].slice(0, 4),
      pinnedIds: new Set(pinned.map((p) => p.id)),
    };
  }, [posts, usedIds2, now]);

  const usedIds3 = useMemo(() => {
    const s = new Set(usedIds2);
    for (const p of radarPick.items) s.add(p.id);
    return s;
  }, [usedIds2, radarPick]);

  // 6. 마감미정 혜택 — deadline NULL만 (추정마감 카드와 별개 선반)
  const alwaysOpen = useMemo(
    () =>
      posts
        .filter((p) => p.deadline === null && !usedIds3.has(p.id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 4),
    [posts, usedIds3]
  );

  // 7. 시기 허브 건수
  const stageCounts = useMemo(() => {
    const m = new Map<StageCategory, number>();
    for (const s of HUB_STAGES) m.set(s, 0);
    for (const p of posts) {
      for (const s of p.stage_categories) {
        if (m.has(s)) m.set(s, (m.get(s) ?? 0) + 1);
      }
    }
    return m;
  }, [posts]);

  const cardStatus = (id: string) =>
    statusHydrated ? statusMap[id] ?? null : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-4">
      {previewMode && <PreviewNotice viewMode={previewMode} />}

      {/* 검색바 — 탭하면 탐색 페이지 검색으로 */}
      <Link
        href="/explore?focus=1"
        data-tutorial="search"
        className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400"
      >
        <span aria-hidden>🔍</span> 브랜드·키워드 검색
      </Link>

      <AdSlot id="top_banner" />

      {/* ═══════ 존 A: 마이레이더 ═══════ */}
      <section className="-mx-4 rounded-b-3xl bg-gradient-to-b from-rose-50/90 via-rose-50/40 to-transparent px-4 pb-2 pt-4">
        <ZoneHeader
          emoji="📡"
          title="마이레이더"
          subtitle="내 맞춤만 모았어요"
        />

        {/* 1. 오늘의 레이더 브리핑 */}
        <HeroBriefing
          scan={scan}
          hasChildren={hasChildren}
          loggedIn={loggedIn}
          keywordTotal={keywordData.total}
        />

        {/* 2. 마감 레이더 */}
        {deadlineRadar.items.length > 0 && (
          <div id="deadline-radar" className="mb-6 scroll-mt-16">
            <SectionHeader
              title="마감 레이더 — 놓치기 전에"
              right={
                loggedIn && interestedCount > 0 ? (
                  <Link
                    href="/my"
                    className="text-[11px] font-bold text-rose-600"
                  >
                    관심 {interestedCount}건 더 보기 →
                  </Link>
                ) : null
              }
            />
            {deadlineRadar.source !== "interested" && (
              <p className="mb-2 text-[11px] text-slate-400">
                {deadlineRadar.source === "my_child"
                  ? "우리 아이 시기 중 3일 안에 마감되는 카드예요"
                  : "3일 안에 마감되는 카드예요 · 관심 ★을 눌러두면 여기서 챙겨드려요"}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {deadlineRadar.items.map((p) => (
                <PostCardCompact key={p.id} post={p} />
              ))}
            </div>
            {!loggedIn && (
              <p className="mt-2 text-[11px] text-slate-500">
                가입하면 찜한 카드를 계정에 보관하고, 마감 임박 소식을 알림에서
                챙겨드려요
              </p>
            )}
          </div>
        )}

        {/* 3. 요즘 키워드 모아보기 */}
        {keywordData.entries.length > 0 && (
          <div id="keyword-news" className="mb-6 scroll-mt-16">
            <SectionHeader
              title="요즘 키워드 모아보기"
              right={
                <span className="text-[11px] font-semibold text-slate-400">
                  최근 {KEYWORD_WINDOW_DAYS}일
                </span>
              }
            />
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {keywordData.entries.map((e) => (
                <button
                  key={e.kw}
                  type="button"
                  onClick={() => setSelectedKw(e.kw)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    activeKwEntry?.kw === e.kw
                      ? "bg-rose-500 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  {e.kw} {e.matches.length}
                </button>
              ))}
            </div>
            {activeKwEntry && (
              <CardRail>
                {activeKwEntry.matches.slice(0, 8).map((p) => (
                  <RailCard key={p.id}>
                    <PostCard post={p} status={cardStatus(p.id)} />
                  </RailCard>
                ))}
              </CardRail>
            )}
          </div>
        )}

        {/* 4. 우리 아이 시기 신규 */}
        {hasChildren && myChildNew.length > 0 && (
          <div className="mb-6">
            <SectionHeader
              title="우리 아이 시기, 새로 뜬 혜택"
              right={
                <span className="flex gap-1">
                  {myChildStages
                    .filter((s) => s !== "all_ages")
                    .slice(0, 2)
                    .map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                      >
                        {STAGE_LABELS[s]}
                      </span>
                    ))}
                </span>
              }
            />
            <CardRail>
              {myChildNew.map((p) => (
                <RailCard key={p.id}>
                  <PostCard post={p} status={cardStatus(p.id)} />
                </RailCard>
              ))}
            </CardRail>
          </div>
        )}

        {/* 4-변형. 로그인만(자녀 X) → 자녀 등록 유도 배너 */}
        {loggedIn && !hasChildren && (
          <div className="mb-6">
            <SectionHeader title="우리 아이 시기, 새로 뜬 혜택" />
            <Link
              href="/signup/profile"
              className="block rounded-2xl border border-dashed border-rose-200 bg-white/70 px-4 py-5 text-center"
            >
              <p className="text-sm font-bold text-slate-800">
                생일만 넣으면, 매일 우리 아이 것만 골라드려요
              </p>
              <p className="mt-1 text-xs text-slate-500">
                임신 중이면 출산 예정일로도 돼요
              </p>
              <span className="mt-3 inline-block rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white">
                아이 정보 등록하기
              </span>
            </Link>
          </div>
        )}

        {/* 4-변형. 비로그인 → 실카드 2장 + 잠금 카드 */}
        {!loggedIn && guestStageTeaser && (
          <div className="mb-6">
            <SectionHeader
              title={`${STAGE_LABELS[guestStageTeaser.stage]} 시기, 새로 뜬 혜택`}
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {guestStageTeaser.cards.map((p) => (
                <PostCard key={p.id} post={p} status={cardStatus(p.id)} />
              ))}
              <Link
                href="/signup"
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-300 bg-rose-50/60 px-4 py-6 text-center"
              >
                <span aria-hidden className="text-2xl">
                  🔓
                </span>
                <p className="text-xs font-bold leading-snug text-rose-700">
                  우리 아이 생일 등록하면
                  <br />이 줄이 매일 자동으로 채워져요
                </p>
                <span className="rounded-full bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white">
                  30초 가입하기
                </span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ═══════ 존 B: 엄빠레이더 추천 ═══════ */}
      <section className="pt-2">
        <ZoneHeader
          emoji="🐻"
          title="엄빠레이더 추천"
          subtitle="오늘 골라봤어요"
        />

        {/* 5. 추천 픽 */}
        {radarPick.items.length > 0 && (
          <div className="mb-6">
            <SectionHeader title="엄빠레이더 추천 픽" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {radarPick.items.map((p) => (
                <div key={p.id} className="relative">
                  {radarPick.pinnedIds.has(p.id) && (
                    <span className="pointer-events-none absolute -top-2 left-2 z-10 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-extrabold text-white shadow">
                      🐻 PICK
                    </span>
                  )}
                  <PostCard post={p} status={cardStatus(p.id)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. 마감미정 혜택 */}
        {alwaysOpen.length > 0 && (
          <div className="mb-6">
            <SectionHeader
              title="마감미정 혜택"
              right={
                <span className="text-[11px] font-semibold text-slate-400">
                  천천히 봐도 돼요
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {alwaysOpen.map((p) => (
                <PostCard key={p.id} post={p} status={cardStatus(p.id)} />
              ))}
            </div>
          </div>
        )}

        {/* 7. 시기별로 둘러보기 */}
        <div className="mb-6">
          <SectionHeader title="시기별로 둘러보기" />
          <div data-tutorial="filter-pills" className="grid grid-cols-3 gap-2">
            {HUB_STAGES.map((s) => {
              const n = stageCounts.get(s) ?? 0;
              const mine =
                hasChildren && s !== "all_ages" && myChildStages.includes(s);
              return (
                <Link
                  key={s}
                  href={`/explore?stage=${s}`}
                  className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-3 transition ${
                    n === 0
                      ? "border-slate-100 bg-slate-50 opacity-50"
                      : mine
                        ? "border-rose-300 bg-rose-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  {mine && (
                    <span className="absolute right-1.5 top-1.5 text-[9px] font-bold text-rose-500">
                      💛 내 아이
                    </span>
                  )}
                  <span aria-hidden className="text-xl leading-none">
                    {STAGE_ICONS[s]}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {STAGE_LABELS[s]}
                  </span>
                  <span className="text-[10px] text-slate-400">{n}건</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. 전체 탐색 CTA */}
      <Link
        href="/explore"
        className="mb-4 block rounded-2xl bg-slate-900 px-4 py-3.5 text-center text-sm font-bold text-white transition hover:bg-slate-800"
      >
        전체 {posts.length}건 카드 모두 보기 →
      </Link>
    </main>
  );
}

// ── 공통 부품 ─────────────────────────────────

function PreviewNotice({ viewMode }: { viewMode: string }) {
  const chip = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-500"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-[11px] font-bold text-amber-800">
        🧪 미리보기 — 로그인 상태별 화면 확인용 테스트 페이지
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chip("/test", "실제 내 상태", viewMode === "real")}
        {chip("/test?view=guest", "비로그인 화면", viewMode === "guest")}
        {chip("/test?view=member", "로그인만(자녀 X)", viewMode === "member")}
      </div>
    </div>
  );
}

function ZoneHeader({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-base font-extrabold tracking-tight text-slate-900">
        <span aria-hidden>{emoji}</span> {title}
      </h2>
      <p className="text-[11px] text-slate-400">{subtitle}</p>
    </div>
  );
}

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-sm font-extrabold tracking-tight text-slate-800">
        {title}
      </h3>
      {right}
    </div>
  );
}

/** 1. 히어로 브리핑 — 곰 + 헤드라인 + 스탯 칩(앵커) */
function HeroBriefing({
  scan,
  hasChildren,
  loggedIn,
  keywordTotal,
}: {
  scan: { newToday: number; matchingTotal: number; closingToday: number };
  hasChildren: boolean;
  loggedIn: boolean;
  keywordTotal: number;
}) {
  const headline =
    scan.newToday > 0
      ? hasChildren
        ? `오늘 우리 아이 맞춤 ${scan.newToday}건 새로 떴어요 🎉`
        : `오늘 새로 ${scan.newToday}건 스캔했어요`
      : "엄빠 대신 매일 혜택 스캔 중 ♥";
  const subline = hasChildren
    ? `우리 아이 맞춤 혜택 ${scan.matchingTotal}건을 챙기고 있어요`
    : loggedIn
      ? "아이 정보를 등록하면 내 것만 골라드려요"
      : "매일 새 혜택을 자동으로 모으고 있어요";

  return (
    <section
      data-tutorial="scan-banner"
      className="mb-5 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="shrink-0 text-2xl leading-none">
          🐻
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-rose-700">
            {headline}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{subline}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {scan.closingToday > 0 && (
          <a
            href="#deadline-radar"
            className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white"
          >
            ⏰ 오늘 마감 {scan.closingToday}건
          </a>
        )}
        {keywordTotal > 0 && (
          <a
            href="#keyword-news"
            className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
          >
            🔔 키워드 새소식 {keywordTotal}건
          </a>
        )}
      </div>
    </section>
  );
}

/** 2. 컴팩트 카드 — 마감 레이더 전용 (썸네일 + 제목 + D-day) */
function PostCardCompact({ post }: { post: Post }) {
  const dday = calcDDay(post.deadline);
  return (
    <Link
      href={`/post/${post.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition hover:shadow-[0_6px_20px_rgba(15,23,42,0.10)]"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {post.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg">
            📡
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {post.brand_name && (
          <p className="truncate text-[10px] font-semibold text-rose-600">
            {post.brand_name}
          </p>
        )}
        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900">
          {post.title}
        </p>
      </div>
      {dday && (
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
            post.deadline_unknown
              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              : dday.urgent
                ? "bg-rose-500 text-white"
                : "bg-slate-100 text-slate-600"
          }`}
          title={
            post.deadline_unknown
              ? "마감 추정 — 원문에서 정확한 마감을 확인하세요"
              : undefined
          }
        >
          {post.deadline_unknown ? `~${dday.label} 추정` : dday.label}
        </span>
      )}
    </Link>
  );
}

/** 가로 카드 레일 — 158px 카드 + 다음 카드 peek */
function CardRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function RailCard({ children }: { children: React.ReactNode }) {
  return <div className="w-[158px] shrink-0 snap-start">{children}</div>;
}

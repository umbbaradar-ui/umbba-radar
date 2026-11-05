// ============================================
// 매시 heartbeat 판정 규칙 — DB·네트워크 없는 순수 함수 (R-20261105-3 2단계)
//
// 정상이면 조용하고, 문제면 원인과 할 일을 한 줄로 보낸다.
//   - 같은 알림은 6시간에 1번
//   - 해소되면 "🟢 복구됨" 1줄
// ============================================

export const ALERT_INTERVAL_MS = 6 * 3600 * 1000;
// cron이 몇 분 밀려도 6시간 주기가 7시간으로 늘어나지 않게 둔 여유
const INTERVAL_SLACK_MS = 10 * 60 * 1000;
export const DRAFT_STUCK = 100;
const INGEST_DUE_HOUR_KST = 6;
const CONSECUTIVE = 2;

export type AlertKey = "no_ingest" | "draft_stuck" | "publish_stuck";

export interface HeartbeatInput {
  nowMs: number;
  todayIngested: number; // KST 오늘 수집(source_type='ingestion') 카드 수
  draftBacklog: number; // 미분류(draft)
  publishable: number; // 지금 자동 발행 가능한 후보(pass·85+ 등, 미리보기 기준)
  publishError?: string; // 후보 조회 실패 사유
}

export interface HeartbeatState {
  streak: Partial<Record<AlertKey, number>>;
  lastSent: Partial<Record<AlertKey, string>>; // ISO
  active: AlertKey[];
}

export const EMPTY_STATE: HeartbeatState = { streak: {}, lastSent: {}, active: [] };

export interface HeartbeatDecision {
  state: HeartbeatState;
  send: AlertKey[]; // 이번에 보낼 알림(전송 성공 시 markSent로 기록)
  recovered: AlertKey[];
  lines: string[]; // 텔레그램 본문 줄. 비었으면 보내지 않는다.
}

const LABEL: Record<AlertKey, string> = {
  no_ingest: "새벽 수집",
  draft_stuck: "분류",
  publish_stuck: "자동 발행",
};

export function kstHour(nowMs: number): number {
  return new Date(nowMs + 9 * 3600 * 1000).getUTCHours();
}

/** KST 오늘 0시의 ISO(UTC) */
export function kstTodayStartIso(nowMs: number): string {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const start = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  return new Date(start - 9 * 3600 * 1000).toISOString();
}

function alertLine(key: AlertKey, input: HeartbeatInput): string {
  if (key === "no_ingest") {
    return "🔴 <b>새벽 수집 안 됨</b> (오늘 0건) — 할 일: M4 꺼짐/BD 확인";
  }
  if (key === "draft_stuck") {
    return `🟡 <b>분류 멈춤</b> (미분류 ${input.draftBacklog}건, 2회 연속) — 할 일: M4 claude 토큰/로그인 확인`;
  }
  const why = input.publishError
    ? `후보 조회 오류 ${input.publishError.slice(0, 80)}`
    : `후보 ${input.publishable}건 남음, 2회 연속`;
  return `🔴 <b>자동 발행 실패</b> (${why}) — 할 일: Vercel Logs /api/cron/publish 확인`;
}

export function evaluateHeartbeat(
  input: HeartbeatInput,
  prev: HeartbeatState = EMPTY_STATE
): HeartbeatDecision {
  const streak: HeartbeatState["streak"] = {};
  const conditions: Record<AlertKey, boolean> = {
    no_ingest: input.todayIngested === 0,
    draft_stuck: input.draftBacklog >= DRAFT_STUCK,
    publish_stuck: input.publishable > 0 || Boolean(input.publishError),
  };
  for (const k of Object.keys(conditions) as AlertKey[]) {
    streak[k] = conditions[k] ? (prev.streak[k] ?? 0) + 1 : 0;
  }

  // 06:00 전에는 오늘 수집을 아직 판정할 수 없다 — 어제 알림을 복구로 착각하지 않게 그대로 둔다.
  const ingestDue = kstHour(input.nowMs) >= INGEST_DUE_HOUR_KST;

  const active: AlertKey[] = [];
  if (ingestDue ? conditions.no_ingest : prev.active.includes("no_ingest")) {
    active.push("no_ingest");
  }
  if ((streak.draft_stuck ?? 0) >= CONSECUTIVE) active.push("draft_stuck");
  if ((streak.publish_stuck ?? 0) >= CONSECUTIVE) active.push("publish_stuck");

  const send = active.filter((k) => {
    if (k === "no_ingest" && !ingestDue) return false;
    const last = prev.lastSent[k];
    if (!last) return true;
    return input.nowMs - Date.parse(last) >= ALERT_INTERVAL_MS - INTERVAL_SLACK_MS;
  });
  // 알림을 실제로 보낸 적 있는 건만 복구를 알린다.
  const recovered = prev.active.filter((k) => !active.includes(k) && prev.lastSent[k]);

  const lines = [
    ...send.map((k) => alertLine(k, input)),
    ...recovered.map((k) => `🟢 복구됨 — ${LABEL[k]}`),
  ];

  return { state: { streak, lastSent: { ...prev.lastSent }, active }, send, recovered, lines };
}

/** 전송 성공한 알림만 기록한다 — 실패하면 다음 회차에 다시 보낸다. */
export function markSent(
  state: HeartbeatState,
  keys: AlertKey[],
  nowMs: number
): HeartbeatState {
  const lastSent = { ...state.lastSent };
  const at = new Date(nowMs).toISOString();
  for (const k of keys) lastSent[k] = at;
  return { ...state, lastSent };
}

/** 09:00 리포트 — 정상일 때의 한 줄 */
export function normalReportLine(collected: number, published: number, pending: number): string {
  return `✅ 엄빠레이더 정상 · 수집 ${collected} · 발행 ${published} · 대기 ${pending}`;
}

/** 09:00 리포트 — 문제일 때 덧붙이는 "할 일" 한 줄 */
export function reportTodoLine(p: {
  collectFail: boolean;
  backlogStuck: boolean;
  publishError: boolean;
}): string {
  const todo: string[] = [];
  if (p.collectFail) todo.push("M4 꺼짐/BD 확인");
  if (p.backlogStuck) todo.push("M4 claude 토큰/로그인 확인");
  if (p.publishError) todo.push("Vercel Logs /api/cron/publish 확인");
  return `👉 <b>할 일:</b> ${todo.join(" · ")}`;
}

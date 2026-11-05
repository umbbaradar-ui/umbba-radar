// ============================================
// 서버 새벽 수집 규칙 — DB·네트워크 없는 순수 함수 (R-20261105-3 3단계)
//
// tools/umbba-cli/bd_client.py · bd_ingest.py 와 같은 결과를 내도록 옮겼다.
// 분류·검수는 서버로 옮기지 않는다(맥 로컬 구독 Claude 몫). 여기는 draft 카드까지만.
// ============================================

export const MAX_ACCOUNTS = 800; // bd-run.sh 기본값
export const RECENT_POSTS = 3; // bd_ingest --recent 기본값
export const SCAN_DAYS = 1; // bd-run.sh 인자
export const NEW_SCAN_DAYS = 3; // bd_ingest --new-scan-days 기본값
export const CAPTION_MAX = 2000;
const STARVED_MIN_ACCOUNTS = 50;
const STARVED_RATIO = 0.1;
const FAILED_RATIO = 0.3;
const LATE_HOUR_KST = 5;

const KST_MS = 9 * 3600 * 1000;

export type BdStage =
  | "triggering" // BD 호출 직전 — 같은 날 중복 과금을 막는 자리표
  | "triggered" // 스냅샷 대기
  | "processing" // 적재 중(cursor까지 끝남)
  | "done"
  | "partial" // 이미지 실패가 많음 — 맥이 같은 스냅샷을 재처리(재과금 0)
  | "starved" // 스냅샷은 왔는데 거의 빈 응답 — 맥 예비 수집기로
  | "failed"
  | "mac_takeover"; // 맥이 넘겨받음 — 서버는 더 진행하지 않는다

export interface BdRunState {
  date: string; // KST YYYY-MM-DD
  stage: BdStage;
  snapshot_id: string | null;
  accounts: string[];
  cursor: number; // 카드 후보(pairs) 중 처리한 수
  total: number;
  received: number;
  billed: number;
  created: number;
  dup: number;
  failed: number;
  noimg: number;
  per_user_new: Record<string, number>;
  error: string | null;
  triggered_at: string | null;
  notified_at: string | null; // 웹훅 도착 시각. 진행 판정에는 쓰지 않는다(깨우는 신호일 뿐).
  finished_at: string | null;
  lease_until: string | null; // 웹훅·매시 cron이 같은 레코드를 겹쳐 처리하지 않게
  reported: boolean; // instagram_accounts.last_scanned_at 보고 완료
}

export function newRunState(date: string, accounts: string[]): BdRunState {
  return {
    date,
    stage: "triggering",
    snapshot_id: null,
    accounts,
    cursor: 0,
    total: 0,
    received: 0,
    billed: 0,
    created: 0,
    dup: 0,
    failed: 0,
    noimg: 0,
    per_user_new: {},
    error: null,
    triggered_at: null,
    notified_at: null,
    finished_at: null,
    lease_until: null,
    reported: false,
  };
}

export function kstDate(nowMs: number): string {
  return new Date(nowMs + KST_MS).toISOString().slice(0, 10);
}

/** BD start_date 형식 MM-DD-YYYY (KST 기준 N일 전) */
export function bdStartDate(nowMs: number, days: number): string {
  const [y, m, d] = new Date(nowMs + KST_MS - days * 86400000)
    .toISOString()
    .slice(0, 10)
    .split("-");
  return `${m}-${d}-${y}`;
}

export interface ActiveAccount {
  username: string;
  last_scanned_at: string | null;
}

/** bd_client.trigger_discover 의 input 배열. 정렬은 서버가 오래 안 본 순으로 준다. */
export function buildDiscoverInputs(accounts: ActiveAccount[], nowMs: number) {
  const commonStart = bdStartDate(nowMs, SCAN_DAYS);
  const newStart = bdStartDate(nowMs, NEW_SCAN_DAYS);
  return accounts.slice(0, MAX_ACCOUNTS).map((a) => ({
    url: `https://www.instagram.com/${a.username.trim().replace(/^@/, "")}`,
    num_of_posts: RECENT_POSTS,
    start_date: a.last_scanned_at === null ? newStart : commonStart,
    end_date: "",
    post_type: "",
  }));
}

// ---- 레코드 → 카드 후보 (bd_client.map_record) ----

export type BdRecord = Record<string, unknown>;

export interface CardCandidate {
  url: string;
  author: string;
  caption: string;
  imageUrl: string | null;
  sourcePostDate: string | null;
}

function firstPhoto(rec: BdRecord): string | null {
  const pc = rec.post_content;
  if (Array.isArray(pc) && pc.length > 0) {
    const photos = pc
      .filter(
        (x): x is { type?: string; index?: number; url?: string } =>
          typeof x === "object" && x !== null &&
          String((x as { type?: unknown }).type ?? "").toLowerCase() === "photo"
      )
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (photos[0]?.url) return photos[0].url;
  }
  const list = rec.photos;
  if (Array.isArray(list) && list.length > 0) return (list[0] as string) || null;
  return null;
}

export function firstImage(rec: BdRecord): string | null {
  const ct = String(rec.content_type ?? "").toLowerCase();
  const thumb = (rec.thumbnail as string | undefined) || null;
  if (ct === "video" || ct === "reel") return thumb || firstPhoto(rec);
  return firstPhoto(rec) || thumb;
}

export function toCandidates(records: BdRecord[]): CardCandidate[] {
  const out: CardCandidate[] = [];
  for (const rec of records) {
    const url = rec.url;
    if (typeof url !== "string" || !url) continue; // 오류 행(dead_page 등)
    out.push({
      url,
      author: String(rec.user_posted ?? "?"),
      caption: String(rec.description ?? "").slice(0, CAPTION_MAX),
      imageUrl: firstImage(rec),
      sourcePostDate: (rec.date_posted as string | undefined) ?? null,
    });
  }
  return out;
}

// ---- 판정 ----

export function isStarved(accounts: number, received: number): boolean {
  return accounts >= STARVED_MIN_ACCOUNTS && received < accounts * STARVED_RATIO;
}

/** 적재가 끝난 뒤의 최종 단계 */
export function finalStage(s: {
  accounts: number;
  received: number;
  created: number;
  failed: number;
}): BdStage {
  if (isStarved(s.accounts, s.received)) return "starved";
  const tried = s.created + s.failed;
  if (s.failed > 0 && s.failed / tried > FAILED_RATIO) return "partial";
  return "done";
}

/** 05:00 KST까지 서버 수집이 끝나지 않았는가 (서버 수집이 켜졌을 때만) */
export function isBdLate(input: {
  enabled: boolean;
  nowMs: number;
  stage: BdStage | null; // 오늘 실행 없음 = null
}): boolean {
  if (!input.enabled) return false;
  if (new Date(input.nowMs + KST_MS).getUTCHours() < LATE_HOUR_KST) return false;
  return (
    input.stage === null ||
    input.stage === "triggering" ||
    input.stage === "triggered" ||
    input.stage === "processing" ||
    input.stage === "failed"
  );
}

// ---- 적재 루프 (입출력은 ports로 주입 — 시험 가능) ----

export type CardResult = "created" | "dup" | "failed" | "noimg";

export interface ProcessPorts {
  existingUrls(urls: string[]): Promise<Set<string>>;
  createCard(c: CardCandidate): Promise<CardResult>;
  checkpoint(state: BdRunState): Promise<void>;
  nowMs(): number;
}

const BATCH = 5;
const CHECKPOINT_EVERY = 4; // 배치 수

/** cursor부터 마감 시각까지 처리한다. 다음 회차는 state.cursor부터 잇는다. */
export async function processCandidates(
  cands: CardCandidate[],
  state: BdRunState,
  ports: ProcessPorts,
  deadlineMs: number
): Promise<BdRunState> {
  const s: BdRunState = { ...state, per_user_new: { ...state.per_user_new } };
  s.total = cands.length;
  let batches = 0;
  while (s.cursor < cands.length && ports.nowMs() < deadlineMs) {
    const batch = cands.slice(s.cursor, s.cursor + BATCH);
    const existing = await ports.existingUrls(batch.map((c) => c.url));
    const seen = new Set<string>();
    const results = await Promise.all(
      batch.map(async (c) => {
        if (existing.has(c.url) || seen.has(c.url)) return "dup" as const;
        seen.add(c.url);
        if (!c.imageUrl) return "noimg" as const;
        return ports.createCard(c);
      })
    );
    results.forEach((r, i) => {
      s[r] += 1;
      if (r === "created") {
        const author = batch[i].author.toLowerCase();
        s.per_user_new[author] = (s.per_user_new[author] ?? 0) + 1;
      }
    });
    s.cursor += batch.length;
    batches += 1;
    if (batches % CHECKPOINT_EVERY === 0) await ports.checkpoint(s);
  }
  return s;
}

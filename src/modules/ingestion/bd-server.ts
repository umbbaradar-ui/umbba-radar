// ============================================
// 서버 새벽 수집 (R-20261105-3 3단계)
//
// 03:00 KST cron → BD discover trigger → (웹훅 또는 매시 cron이 깨움) → draft 카드 적재.
// 상태는 events 테이블 event_name='bd_server_run' 하루 1행(마이그레이션 없이 재사용).
// 완료 판정은 BD progress 폴링이 정본이고, 웹훅은 빨리 깨우는 신호일 뿐이다.
// BRIGHTDATA_API_TOKEN·BD_WEBHOOK_SECRET env가 없으면 전부 아무 일도 하지 않는다.
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import { listActiveAccounts } from "@/modules/ingestion/accounts/repository";
import {
  MAX_ACCOUNTS,
  buildDiscoverInputs,
  finalStage,
  kstDate,
  newRunState,
  processCandidates,
  toCandidates,
  type BdRecord,
  type BdRunState,
  type BdStage,
  type CardCandidate,
  type CardResult,
} from "@/modules/ingestion/bd-run-rules";

export const BD_EVENT_NAME = "bd_server_run";
const BASE = "https://api.brightdata.com/datasets/v3";
const DEFAULT_DATASET = "gd_lk5ns7kz21pck8jpis";
const IMAGE_MAX = 10 * 1024 * 1024;
const LEASE_SLACK_MS = 30 * 1000;
const REPORT_CHUNK = 200;

export function bdServerEnabled(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_TOKEN && process.env.BD_WEBHOOK_SECRET);
}

function bdHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.BRIGHTDATA_API_TOKEN}` };
}

interface RunRow {
  id: number;
  state: BdRunState;
}

export async function loadRun(date: string): Promise<RunRow | null> {
  const { data, error } = await supabaseServer
    .from("events")
    .select("id, properties")
    .eq("event_name", BD_EVENT_NAME)
    .eq("properties->>date", date)
    .order("id", { ascending: true })
    .limit(1);
  if (error) throw new Error(`bd run load: ${error.message}`);
  const row = data?.[0] as { id: number; properties: BdRunState } | undefined;
  return row ? { id: row.id, state: row.properties } : null;
}

async function saveRun(id: number, state: BdRunState): Promise<void> {
  const { error } = await supabaseServer
    .from("events")
    .update({ properties: state })
    .eq("id", id);
  if (error) throw new Error(`bd run save: ${error.message}`);
}

// ---- trigger ----

async function postTrigger(
  inputs: ReturnType<typeof buildDiscoverInputs>,
  notifyUrl: string | null
): Promise<Response> {
  const params = new URLSearchParams({
    dataset_id: (process.env.BRIGHTDATA_DATASET_ID || DEFAULT_DATASET).trim(),
    include_errors: "true",
    type: "discover_new",
    discover_by: "url",
  });
  if (notifyUrl) params.set("notify", notifyUrl);
  return fetch(`${BASE}/trigger?${params}`, {
    method: "POST",
    headers: { ...bdHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ input: inputs }),
    signal: AbortSignal.timeout(60_000),
  });
}

export type TriggerResult =
  | { status: "disabled" }
  | { status: "exists"; stage: BdStage }
  | { status: "no_accounts" }
  | { status: "triggered"; snapshot_id: string; accounts: number; notify: boolean }
  | { status: "failed"; error: string };

export async function triggerBdRun(origin: string, nowMs = Date.now()): Promise<TriggerResult> {
  if (!bdServerEnabled()) return { status: "disabled" };
  const date = kstDate(nowMs);
  // 비용 가드: 같은 날 두 번 trigger하지 않는다.
  const existing = await loadRun(date);
  if (existing) return { status: "exists", stage: existing.state.stage };

  const accounts = (await listActiveAccounts()).slice(0, MAX_ACCOUNTS);
  if (accounts.length === 0) return { status: "no_accounts" };

  const state = newRunState(date, accounts.map((a) => a.username));
  const { data: inserted, error: insErr } = await supabaseServer
    .from("events")
    .insert({ event_name: BD_EVENT_NAME, properties: state })
    .select("id")
    .single();
  if (insErr) throw new Error(`bd run insert: ${insErr.message}`);
  const myId = (inserted as { id: number }).id;
  // cron이 겹쳐 들어왔으면 가장 먼저 쓴 쪽만 BD를 부른다.
  const first = await loadRun(date);
  if (first && first.id !== myId) {
    await supabaseServer.from("events").delete().eq("id", myId);
    return { status: "exists", stage: first.state.stage };
  }

  const inputs = buildDiscoverInputs(accounts, nowMs);
  const notifyUrl = `${origin}/api/bd/webhook?key=${encodeURIComponent(
    process.env.BD_WEBHOOK_SECRET ?? ""
  )}`;
  try {
    let usedNotify = true;
    let res = await postTrigger(inputs, notifyUrl);
    // notify 형식을 BD가 거부해도 수집은 해야 한다. 4xx는 과금 전이다. 그 뒤는 매시 폴링이 잇는다.
    if (res.status >= 400 && res.status < 500) {
      console.warn("[bd-server] notify 거부 추정, 없이 재시도:", res.status);
      usedNotify = false;
      res = await postTrigger(inputs, null);
    }
    const text = await res.text();
    const sid = res.ok ? (JSON.parse(text) as { snapshot_id?: string }).snapshot_id : undefined;
    if (!sid) throw new Error(`trigger HTTP ${res.status}: ${text.slice(0, 200)}`);
    await saveRun(myId, {
      ...state,
      stage: "triggered",
      snapshot_id: sid,
      triggered_at: new Date(nowMs).toISOString(),
    });
    return { status: "triggered", snapshot_id: sid, accounts: inputs.length, notify: usedNotify };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await saveRun(myId, { ...state, stage: "failed", error: error.slice(0, 300) });
    return { status: "failed", error };
  }
}

// ---- 적재 ----

async function fetchProgress(sid: string): Promise<{ status: string; records?: number }> {
  const r = await fetch(`${BASE}/progress/${sid}`, {
    headers: bdHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) return { status: `http${r.status}` };
  return (await r.json()) as { status: string; records?: number };
}

/** 202(빌드 중)면 null */
async function fetchSnapshot(sid: string): Promise<BdRecord[] | null> {
  const r = await fetch(`${BASE}/snapshot/${sid}?format=json`, {
    headers: bdHeaders(),
    signal: AbortSignal.timeout(60_000),
  });
  if (r.status === 202) return null;
  if (!r.ok) throw new Error(`snapshot HTTP ${r.status}`);
  const data = (await r.json()) as BdRecord[] | { data?: BdRecord[] };
  return Array.isArray(data) ? data : data.data ?? [];
}

function mimeToExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/** /api/admin/bulk-ingest-with-image raw=true 와 같은 draft 카드 */
async function createDraftCard(c: CardCandidate): Promise<CardResult> {
  try {
    const img = await fetch(c.imageUrl as string, { signal: AbortSignal.timeout(30_000) });
    if (!img.ok) return "failed";
    const bytes = Buffer.from(await img.arrayBuffer());
    if (bytes.length === 0 || bytes.length > IMAGE_MAX) return "failed";
    const ct = (img.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const mime = ct.startsWith("image/") ? ct : "image/jpeg";

    const filename = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${mimeToExt(mime)}`;
    const { error: upErr } = await supabaseServer.storage
      .from("card-images")
      .upload(filename, bytes, { contentType: mime, cacheControl: "31536000" });
    if (upErr) {
      console.error("[bd-server] upload failed:", upErr.message);
      return "failed";
    }
    const {
      data: { publicUrl },
    } = supabaseServer.storage.from("card-images").getPublicUrl(filename);

    const { data: inserted, error: insErr } = await supabaseServer
      .from("posts")
      .insert({
        kind: "recruiting" as const,
        title: "(미분류 — 분류 대기)",
        brand_name: null,
        thumbnail_url: publicUrl,
        source_url: c.url,
        body: c.caption,
        deadline: null,
        deadline_unknown: false,
        stage_categories: [],
        type_tags: [],
        topic: "parenting",
        is_sponsored: false,
        status: "draft" as const,
        source_type: "ingestion" as const,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[bd-server] insert failed:", insErr.message);
      return "failed";
    }
    if (c.sourcePostDate) {
      await supabaseServer
        .from("posts")
        .update({ source_post_date: c.sourcePostDate })
        .eq("id", (inserted as { id: string }).id);
    }
    return "created";
  } catch (e) {
    console.error("[bd-server] card failed:", e instanceof Error ? e.message : e);
    return "failed";
  }
}

async function existingUrls(urls: string[]): Promise<Set<string>> {
  const { data, error } = await supabaseServer
    .from("posts")
    .select("source_url")
    .in("source_url", urls);
  if (error) throw new Error(`dedupe: ${error.message}`);
  return new Set((data ?? []).map((r) => (r as { source_url: string }).source_url));
}

/** bd_ingest 의 report_account_scan 묶음 처리 — 800번 나눠 부르지 않는다. */
async function reportScans(state: BdRunState): Promise<void> {
  const at = new Date().toISOString();
  for (let i = 0; i < state.accounts.length; i += REPORT_CHUNK) {
    const { error } = await supabaseServer
      .from("instagram_accounts")
      .update({ last_scanned_at: at, last_new_count: 0, last_error: null })
      .in("username", state.accounts.slice(i, i + REPORT_CHUNK).map((u) => u.toLowerCase()));
    if (error) throw new Error(`report: ${error.message}`);
  }
  for (const [username, n] of Object.entries(state.per_user_new)) {
    await supabaseServer
      .from("instagram_accounts")
      .update({ last_new_count: n })
      .eq("username", username);
  }
}

export type AdvanceResult =
  | { status: "disabled" | "no_run" | "locked" | "waiting"; detail?: string }
  | { status: "terminal"; stage: BdStage }
  | { status: "progress"; stage: BdStage; cursor: number; total: number; created: number };

/** 오늘 실행을 budgetMs 안에서 할 수 있는 만큼 진행한다. 몇 번 불러도 안전하다. */
export async function advanceBdRun(budgetMs: number, nowMs = Date.now()): Promise<AdvanceResult> {
  if (!bdServerEnabled()) return { status: "disabled" };
  const row = await loadRun(kstDate(nowMs));
  if (!row) return { status: "no_run" };
  const { id, state } = row;
  if (state.stage !== "triggered" && state.stage !== "processing") {
    return { status: "terminal", stage: state.stage };
  }
  if (state.lease_until && Date.parse(state.lease_until) > nowMs) return { status: "locked" };

  const sid = state.snapshot_id as string;
  const prog = await fetchProgress(sid);
  if (prog.status === "failed" || prog.status === "error") {
    await saveRun(id, { ...state, stage: "failed", error: `snapshot ${prog.status}` });
    return { status: "terminal", stage: "failed" };
  }
  if (prog.status !== "ready") return { status: "waiting", detail: prog.status };

  const records = await fetchSnapshot(sid);
  if (!records) return { status: "waiting", detail: "building" };

  const deadlineMs = nowMs + budgetMs;
  const leased: BdRunState = {
    ...state,
    stage: "processing",
    received: records.length,
    billed: prog.records ?? 0,
    lease_until: new Date(deadlineMs + LEASE_SLACK_MS).toISOString(),
  };
  await saveRun(id, leased);

  const cands = toCandidates(records);
  let next = await processCandidates(
    cands,
    leased,
    {
      existingUrls,
      createCard: createDraftCard,
      checkpoint: (s) => saveRun(id, s),
      nowMs: () => Date.now(),
    },
    deadlineMs
  );

  next = { ...next, lease_until: null };
  if (next.cursor >= cands.length) {
    next.stage = finalStage({
      accounts: next.accounts.length,
      received: next.received,
      created: next.created,
      failed: next.failed,
    });
    next.finished_at = new Date().toISOString();
    // starved는 맥 예비 수집기가 조회한 계정만 보고한다(bd_ingest와 같게).
    if (next.stage !== "starved") {
      await reportScans(next);
      next.reported = true;
    }
  }
  await saveRun(id, next);
  return {
    status: "progress",
    stage: next.stage,
    cursor: next.cursor,
    total: next.total,
    created: next.created,
  };
}

export async function markWebhookArrived(snapshotId: string, nowMs = Date.now()): Promise<boolean> {
  const row = await loadRun(kstDate(nowMs));
  if (!row || row.state.snapshot_id !== snapshotId) return false;
  await saveRun(row.id, { ...row.state, notified_at: new Date(nowMs).toISOString() });
  return true;
}

/** 맥이 넘겨받는다. 이후 서버는 이 실행을 진행하지 않는다. */
export async function takeoverBdRun(nowMs = Date.now()): Promise<BdStage | null> {
  const row = await loadRun(kstDate(nowMs));
  if (!row) return null;
  const { id, state } = row;
  if (state.stage === "done") return state.stage;
  const next: BdRunState = { ...state, stage: "mac_takeover", lease_until: null };
  // 맥의 --snapshot 재처리는 계정 보고를 하지 않으므로 넘길 때 보고해 둔다. 예비 수집은 자기가 보고한다.
  if (state.snapshot_id && !state.reported && state.stage !== "starved" && state.stage !== "failed") {
    await reportScans(next);
    next.reported = true;
  }
  await saveRun(id, next);
  return next.stage;
}

export async function bdRunSummary(nowMs = Date.now()) {
  const date = kstDate(nowMs);
  const { data, error } = await supabaseServer
    .from("events")
    .select("properties")
    .eq("event_name", BD_EVENT_NAME)
    .gte("created_at", new Date(nowMs - 3 * 86400000).toISOString())
    .order("id", { ascending: false })
    .limit(4);
  if (error) throw new Error(`bd summary: ${error.message}`);
  const states = (data ?? []).map((r) => (r as { properties: BdRunState }).properties);
  const s = states.find((x) => x.date === date) ?? null;
  return {
    enabled: bdServerEnabled(),
    date,
    run: s && {
      stage: s.stage,
      snapshot_id: s.snapshot_id,
      accounts: s.accounts.length,
      cursor: s.cursor,
      total: s.total,
      received: s.received,
      billed: s.billed,
      created: s.created,
      dup: s.dup,
      failed: s.failed,
      noimg: s.noimg,
      error: s.error,
      notified_at: s.notified_at,
      lease_active: Boolean(s.lease_until && Date.parse(s.lease_until) > nowMs),
    },
    // 맥이 이미지 힌트·계정 원장을 채우는 데 쓴다(스냅샷 재조회는 무과금).
    recent_snapshots: states.map((x) => x.snapshot_id).filter((x): x is string => Boolean(x)),
  };
}

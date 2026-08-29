// ============================================
// 새벽 파이프라인 워치독 — 서버에서 "어젯밤 수집·분류가 제대로 돌았나" 점검 후 텔레그램 보고.
//
// 현재 파이프라인(옵션 C): BrightData 수집 → posts(status=draft) → 헤드리스 분류 → pending.
// ⚠️ 인스타/외부 API 호출 0 — Supabase posts 테이블만 조회한다.
//
// 트리거: notify-deadline cron(매일 09:00 KST)이 호출. 3시 수집·분류가 끝난 직후라 타이밍이 맞다.
// 매 실행마다 현재 상태 요약을 보낸다 (정상/주의/경보를 한눈에).
// ============================================

import { supabaseServer } from "@/shared/db/supabase-server";
import type { AutoPublishResult } from "@/modules/curation/repository";

export interface WatchdogResult {
  collected24: number; // 최근 24h BrightData 수집 카드 수
  draftBacklog: number; // 미분류(분류 대기) 누적
  pending: number; // 분류완료, 검수 대기
  problem: boolean; // 수집 실패 or 분류 밀림
  sent: boolean;
  /** pending의 2차 검수 상태 분해(023 적용 DB에서만) */
  reviewSummary?: { pass: number; warn: number; fail: number; unreviewed: number };
}

// BrightData 수집은 새벽 1회 → 최근 24h 안에 신규 수집이 있어야 정상.
const COLLECT_WINDOW_HOURS = 24;
// 미분류가 이 이상 쌓여 있으면 "분류 밀림"(분류 미실행/한도 초과) 주의.
const BACKLOG_WARN = 100;

export async function runHealthWatchdog(
  opts: { force?: boolean; autoPublish?: AutoPublishResult } = {}
): Promise<WatchdogResult> {
  const since24h = new Date(
    Date.now() - COLLECT_WINDOW_HOURS * 3600 * 1000
  ).toISOString();

  const [collectedRes, draftRes, pendingRes] = await Promise.all([
    // 최근 24h 자동수집(ingestion) 카드 = BrightData 수집이 정상으로 큐를 긁었다는 신호
    supabaseServer
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "ingestion")
      .gte("created_at", since24h),
    // 미분류(draft) = 분류 대기/밀림
    supabaseServer
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    // 분류완료, 검수 대기
    supabaseServer
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const collected24 = collectedRes.count ?? 0;
  const draftBacklog = draftRes.count ?? 0;
  const pending = pendingRes.count ?? 0;

  // pending의 2차 검수 상태 분해(023) — 미적용 DB면 조용히 생략
  let review:
    | { pass: number; warn: number; fail: number; unreviewed: number }
    | undefined;
  {
    const { data: revData, error: revErr } = await supabaseServer
      .from("posts")
      .select("ai_review_status")
      .eq("status", "pending")
      .limit(2000);
    if (!revErr && revData) {
      review = { pass: 0, warn: 0, fail: 0, unreviewed: 0 };
      for (const r of revData as Array<{ ai_review_status: string | null }>) {
        if (r.ai_review_status === "pass") review.pass++;
        else if (r.ai_review_status === "warn") review.warn++;
        else if (r.ai_review_status === "fail") review.fail++;
        else review.unreviewed++;
      }
    }
  }

  // 문제 = 수집 0건(BD/3시 작업 죽음) 또는 분류가 크게 밀림(분류 미실행/한도 초과).
  const collectFail = collected24 === 0;
  const backlogStuck = draftBacklog >= BACKLOG_WARN;
  const problem = collectFail || backlogStuck;

  const todayKst = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const lines: string[] = [
    `🌅 <b>엄빠레이더 새벽 리포트</b> (${todayKst})`,
  ];
  if (opts.force) lines.push(`🧪 (테스트 발송 — 알림 경로 점검)`);
  lines.push(``);

  // 1) 수집 — BrightData가 정상으로 큐를 긁었는지
  lines.push(
    collectFail
      ? `🔴 <b>수집: 0건</b> — BrightData 스캔/3시 작업 점검 필요`
      : `🟢 수집: 정상 (최근 24h +${collected24}건)`
  );

  // 2) 분류 — 밀린(비정상) 작업이 있는지 / 정상 처리됐는지
  lines.push(
    backlogStuck
      ? `🟡 <b>분류: 밀림 ${draftBacklog}건</b> — 분류 미실행/한도 점검 필요`
      : draftBacklog === 0
        ? `🟢 분류: 완료 (미분류 0건)`
        : `🟢 분류: 정상 (미분류 ${draftBacklog}건 · 신규 유입분)`
  );

  // 3) 자동 발행(2차 AI 검수 pass·고점수) 결과
  const ap = opts.autoPublish;
  if (ap) {
    if (ap.error) {
      lines.push(`🔴 <b>자동발행 오류</b> — ${ap.error.slice(0, 120)}`);
    } else if (!ap.enabled) {
      lines.push(`⚪ 자동발행 꺼짐 (AUTO_PUBLISH_ENABLED=false)`);
    } else {
      const extra: string[] = [];
      if (ap.archived > 0) extra.push(`마감보관 ${ap.archived}`);
      if (ap.skippedNoThumb > 0) extra.push(`사진없음 보류 ${ap.skippedNoThumb}`);
      lines.push(
        `🤖 자동발행 <b>+${ap.published}건</b> (${ap.minScore}점+ pass)` +
          (extra.length ? ` · ${extra.join(" · ")}` : "")
      );
    }
  }

  // 4) 검수 대기 = 사람 판단 필요 건 (warn/fail/미검수)
  lines.push(``);
  if (pending > 0) {
    const breakdown = review
      ? ` (⚠️ ${review.warn} · ⛔ ${review.fail} · ◻️ 미검수 ${review.unreviewed}${review.pass > 0 ? ` · ✅ pass ${review.pass}` : ""})`
      : "";
    lines.push(`🧐 <b>판단 필요 ${pending}건</b>${breakdown}`);
  } else {
    lines.push(`✅ 검수 대기 없음`);
  }
  lines.push(``);
  lines.push(`👉 https://umbba-radar.com/admin/queue`);

  const sent = await sendTelegram(lines.join("\n"));

  return { collected24, draftBacklog, pending, problem, sent, reviewSummary: review };
}

async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return Boolean(res.ok && data.ok);
  } catch {
    return false;
  }
}

// ============================================
// B루틴 독립 워치독 — 서버에서 "어젯밤 B루틴이 실제로 돌았나" 점검.
//
// run-b.ps1(로컬) 바깥, 서버에서 돈다. 그래서 로컬 PC가 꺼졌거나 작업이
// 통째로 죽어 헬스리포트조차 못 보낸 "조용한 실패"까지 잡아낸다.
// ⚠️ 인스타 API 호출 0 — Supabase DB만 조회한다 (밴/부하 무관).
//
// 트리거: notify-deadline cron(매일 09:00 KST)이 호출. B루틴(03:30, 최대 5h)이
// 끝난 직후라 타이밍이 맞다.
// ============================================

import { supabaseServer } from "@/shared/db/supabase-server";

export interface WatchdogResult {
  ran: boolean;
  processedRecently: number;
  todo: number;
  cardsRecently: number;
  problem: boolean;
  sent: boolean;
}

// 09:00 점검 기준 최근 8h = ~01:00부터 → 03:30 B런은 포함, 전날 런은 제외.
const WINDOW_HOURS = 8;

export async function runHealthWatchdog(
  opts: { force?: boolean } = {}
): Promise<WatchdogResult> {
  const sinceIso = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();

  const [procRes, todoRes, cardRes] = await Promise.all([
    // B루틴이 done/duplicate/failed로 마킹하며 남기는 processed_at = "처리 활동"
    supabaseServer
      .from("ingest_queue")
      .select("id", { count: "exact", head: true })
      .gte("processed_at", sinceIso),
    supabaseServer
      .from("ingest_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "todo"),
    supabaseServer
      .from("posts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
  ]);

  const processedRecently = procRes.count ?? 0;
  const todo = todoRes.count ?? 0;
  const cardsRecently = cardRes.count ?? 0;
  const ran = processedRecently > 0;
  // 문제 = 큐는 쌓였는데 밤새 한 건도 처리 안 됨 (B루틴 미실행/조기사망 = 조용한 실패)
  const problem = !ran && todo > 0;

  // 쿨다운: 인스타 계정 플래그 회복 대기 등 계획된 중단 중엔 cron 경보(🔴) 억제.
  // 이 날짜(KST)가 지나면 자동으로 다시 경보 재개(fail-safe — 끄고 잊어버려도 살아남). 재개 시 과거 날짜로.
  const COOLDOWN_UNTIL = "2026-06-13";
  const inCooldown =
    new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) < COOLDOWN_UNTIL;

  let message: string | null = null;
  if (opts.force) {
    // 테스트 모드: 실제 경보(🔴) 대신 현재 판정 상태만 보여준다 (오경보 방지).
    // 정시(09시) cron이 아닌 시각에 호출하면 8h 창 밖이라 '미실행 신호'가 뜰 수 있음 — 정상.
    message = [
      `🧪 <b>워치독 테스트</b>`,
      ``,
      inCooldown ? `⏸️ 쿨다운 중 (~${COOLDOWN_UNTIL}): cron 경보 억제됨` : null,
      problem
        ? `🟡 지금 기준 '미실행' 신호 (최근 ${WINDOW_HOURS}h 처리 ${processedRecently} / 대기 ${todo}) — 정시(09시)가 아니면 정상일 수 있음`
        : `🟢 정상 — 최근 ${WINDOW_HOURS}h 처리 ${processedRecently}건, 카드 +${cardsRecently}건`,
      ``,
      `이 메시지가 보이면 알림 경로 정상입니다.`,
    ]
      .filter(Boolean)
      .join("\n");
  } else if (problem && !inCooldown) {
    message = [
      `🔴 <b>엄빠레이더 경보 — B루틴 미실행</b>`,
      ``,
      `어젯밤 자동 분류가 한 건도 처리되지 않았어요.`,
      `대기 큐 <b>${todo}건</b>이 그대로 쌓여 있습니다.`,
      ``,
      `점검: PC 켜짐·로그인·전원 / 작업 스케줄러 'B루틴' 마지막 실행 결과(0x41306=시간초과)`,
    ].join("\n");
  }

  let sent = false;
  if (message) sent = await sendTelegram(message);

  return { ran, processedRecently, todo, cardsRecently, problem, sent };
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

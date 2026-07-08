// ============================================
// POST/GET /api/admin/notify-telegram
// 일일 수집 현황(파이프라인 + 승인 대기)을 텔레그램으로 전송.
// ingest.py --import 완료 후 트리거됨 (Bearer ADMIN_CLI_TOKEN). 수동 테스트도 가능.
// TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정이면 no-op (200).
// ============================================

import { NextResponse } from "next/server";
import { getPipelineStats, getCounts } from "@/modules/curation/service";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  // 인증 — CLI와 동일한 ADMIN_CLI_TOKEN
  const auth = request.headers.get("authorization");
  if (
    !process.env.ADMIN_CLI_TOKEN ||
    auth !== `Bearer ${process.env.ADMIN_CLI_TOKEN}`
  ) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    // 봇 미설정 — 조용히 스킵 (ingest.py가 실패로 보지 않게 200)
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID 미설정",
    });
  }

  const [pipeline, counts] = await Promise.all([getPipelineStats(), getCounts()]);
  const pending = counts.byStatus.pending;
  const todayKst = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const text = [
    `🐻 <b>엄빠레이더 일일 현황</b> (${todayKst})`,
    ``,
    `📡 팔로잉 계정 <b>${pipeline.accountsActive}</b>개 모니터링`,
    `🗂️ 최근 24시간 수집 <b>+${pipeline.last24h.collected}</b>건 (미분류 ${pipeline.draftTotal} · 검수대기 ${pipeline.pendingTotal})`,
    `   └ 검수대기 진입 <b>+${pipeline.last24h.pending}</b> · 마감보관 +${pipeline.last24h.expired} (24h)`,
    `📤 발행 <b>+${pipeline.last24h.published}</b>건 (24h)`,
    pending > 0
      ? `✅ <b>승인 대기 ${pending}건</b> — 검수가 필요해요!`
      : `✅ 승인 대기 없음 — 깔끔합니다 👍`,
    ``,
    `👉 https://umbba-radar.com/admin/queue`,
  ].join("\n");

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    }
  );
  const data = (await tgRes.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
  };

  if (!tgRes.ok || !data.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Telegram API ${tgRes.status}: ${data.description ?? "전송 실패"}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    pending,
    collected24h: pipeline.last24h.collected,
    pendingEntered24h: pipeline.last24h.pending,
    expired24h: pipeline.last24h.expired,
  });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

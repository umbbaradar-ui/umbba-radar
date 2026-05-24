// ============================================
// GET /api/cron/ingest — 자동 수집 cron 엔드포인트
// Vercel Cron이 매일 호출. 수동 트리거도 가능 (Bearer 토큰 필수)
// ============================================

import { NextResponse } from "next/server";
import { runIngestion } from "@/modules/ingestion/service";

// Cron이 오래 걸려도 동작하도록 (Vercel Pro: 최대 300초, Hobby: 60초)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel Cron 또는 수동 트리거 검증
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const stats = await runIngestion();
    console.log("[cron/ingest] completed", stats);
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    console.error("[cron/ingest] failed:", e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}

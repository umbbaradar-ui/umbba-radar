// ============================================
// GET /api/cron/bd-trigger — 03:00 KST Vercel cron (R-20261105-3 3단계)
// 활성 계정 → BrightData discover trigger. env 없으면 아무 일도 하지 않는다.
// ============================================

import { NextResponse } from "next/server";
import { triggerBdRun } from "@/modules/ingestion/bd-server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = host ? `https://${host}` : new URL(request.url).origin;
  try {
    const result = await triggerBdRun(origin);
    console.log("[cron/bd-trigger]", JSON.stringify(result));
    return NextResponse.json({ ok: result.status !== "failed", ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron/bd-trigger] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

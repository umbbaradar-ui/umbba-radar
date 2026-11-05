// ============================================
// CLI 전용 — /api/bd/status (R-20261105-3 3단계)
//   GET  오늘 서버 수집 상태 → 맥 bd-run이 수집을 건너뛸지 정한다
//   POST {action:"takeover"} 맥이 넘겨받음(서버는 더 진행 안 함)
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// ============================================

import { NextResponse } from "next/server";
import { bdRunSummary, takeoverBdRun } from "@/modules/ingestion/bd-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.ADMIN_CLI_TOKEN;
  return Boolean(expected) && request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await bdRunSummary()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "takeover") {
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, stage: await takeoverBdRun() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

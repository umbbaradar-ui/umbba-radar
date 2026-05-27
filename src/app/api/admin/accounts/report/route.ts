// ============================================
// CLI 전용 — POST /api/admin/accounts/report
// 스캔 결과 보고 (last_scanned_at, last_new_count, last_error 업데이트)
// Body: { username, new_count, error }
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// ============================================

import { NextResponse } from "next/server";
import { reportScanResult } from "@/modules/ingestion/accounts/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  username: string;
  new_count: number;
  error?: string | null;
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_CLI_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_CLI_TOKEN env not configured" },
      { status: 500 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!body.username) {
    return NextResponse.json(
      { ok: false, error: "username required" },
      { status: 400 }
    );
  }

  try {
    await reportScanResult(
      body.username,
      body.new_count ?? 0,
      body.error ?? null
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

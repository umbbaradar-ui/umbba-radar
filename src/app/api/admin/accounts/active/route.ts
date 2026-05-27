// ============================================
// CLI 전용 — GET /api/admin/accounts/active
// 활성화된 모니터링 대상 username 목록 반환
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// ============================================

import { NextResponse } from "next/server";
import { listActiveUsernames } from "@/modules/ingestion/accounts/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  try {
    const usernames = await listActiveUsernames();
    return NextResponse.json({ ok: true, usernames });
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

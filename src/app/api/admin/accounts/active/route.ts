// ============================================
// CLI 전용 — GET /api/admin/accounts/active
// 활성화된 모니터링 대상 username 목록 반환
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// ============================================

import { NextResponse } from "next/server";
import { listActiveAccounts } from "@/modules/ingestion/accounts/repository";

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
    // accounts: 신규-계정 첫스캔 백필 판별용(last_scanned_at 포함). usernames는 하위호환.
    const accounts = await listActiveAccounts();
    const usernames = accounts.map((a) => a.username);
    return NextResponse.json({ ok: true, usernames, accounts });
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

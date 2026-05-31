// ============================================
// GET /api/health — 헬스체크 + 콜드스타트 방지용 워밍 핑 타깃
// force-dynamic이라 매번 함수 런타임을 깨움 → GitHub Actions가 주기적으로 호출.
// ============================================

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, t: Date.now() });
}

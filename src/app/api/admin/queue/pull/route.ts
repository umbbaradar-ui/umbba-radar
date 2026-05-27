// ============================================
// CLI 전용 — GET /api/admin/queue/pull?limit=5
//
// CLI 가 ingest_queue 에서 todo N개를 atomic claim → processing 으로 표시 → 응답
// 동시에 처리중이 10분 넘은 행은 자동 todo 복귀 (stale reap)
//
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// ============================================

import { NextResponse } from "next/server";
import { claimNext, reapStuckProcessing } from "@/modules/ingestion/queue/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PullSuccessResponse {
  ok: true;
  items: { id: string; url: string }[];
  reaped: number;
}

interface ErrorResponse {
  ok: false;
  error: string;
}

export async function GET(
  request: Request
): Promise<NextResponse<PullSuccessResponse | ErrorResponse>> {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_CLI_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_CLI_TOKEN env not configured on server" },
      { status: 500 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "5", 10) || 5, 1),
    20
  );

  try {
    // 죽은 processing 정리 (10분 넘으면 todo 로 복귀 → 다음 pull 에서 잡힘)
    const reaped = await reapStuckProcessing();

    const items = await claimNext(limit);
    return NextResponse.json({
      ok: true,
      items: items.map((i) => ({ id: i.id, url: i.url })),
      reaped,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `Queue pull failed: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 }
    );
  }
}

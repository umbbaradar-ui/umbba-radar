// ============================================
// CLI 전용 — POST /api/admin/queue/complete
//
// CLI 가 큐 항목 처리 완료 시 호출.
// Body: { id, status: "done"|"duplicate"|"failed", post_id?, error? }
//
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// ============================================

import { NextResponse } from "next/server";
import {
  markDone,
  markDuplicate,
  markFailed,
} from "@/modules/ingestion/queue/repository";
import type { IngestQueueStatus } from "@/modules/ingestion/queue/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  id: string;
  status: Extract<IngestQueueStatus, "done" | "duplicate" | "failed">;
  post_id?: string | null;
  error?: string | null;
}

interface SuccessResponse {
  ok: true;
}

interface ErrorResponse {
  ok: false;
  error: string;
}

export async function POST(
  request: Request
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
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

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { id, status, post_id, error } = body;
  if (!id || !status) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (id, status)" },
      { status: 400 }
    );
  }

  try {
    if (status === "done") {
      await markDone(id, post_id ?? null);
    } else if (status === "duplicate") {
      if (!post_id) {
        return NextResponse.json(
          { ok: false, error: "duplicate status requires post_id" },
          { status: 400 }
        );
      }
      await markDuplicate(id, post_id);
    } else if (status === "failed") {
      await markFailed(id, error ?? "CLI reported failure without message");
    } else {
      return NextResponse.json(
        { ok: false, error: `Invalid status: ${status}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `Complete failed: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 }
    );
  }
}

// ============================================
// CLI 전용 — POST /api/admin/queue/add
// 스캔으로 발견한 URL 들을 ingest_queue 에 일괄 추가
// Body: { urls: string[] }
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// ============================================

import { NextResponse } from "next/server";
import { addUrlsToQueue } from "@/modules/ingestion/queue/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  urls: string[];
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

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "urls array required" },
      { status: 400 }
    );
  }
  if (body.urls.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Max 200 urls per request" },
      { status: 400 }
    );
  }

  try {
    const data = await addUrlsToQueue(body.urls);
    return NextResponse.json({ ok: true, ...data });
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

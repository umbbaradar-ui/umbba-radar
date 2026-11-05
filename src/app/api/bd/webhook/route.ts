// ============================================
// POST /api/bd/webhook?key=... — BD 완료 통지 (R-20261105-3 3단계)
// 깨우는 신호일 뿐이다. 진행 판정은 advanceBdRun 이 BD progress로 다시 확인한다.
// 응답을 먼저 주고 적재는 after()로 이어 간다.
// ============================================

import { after, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { advanceBdRun, markWebhookArrived } from "@/modules/ingestion/bd-server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUDGET_MS = 260_000;

function keyMatches(given: string | null): boolean {
  const expected = process.env.BD_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!keyMatches(new URL(request.url).searchParams.get("key"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { snapshot_id?: string } | null;
  const sid = body?.snapshot_id;
  const known = sid ? await markWebhookArrived(sid).catch(() => false) : false;
  console.log("[bd/webhook]", JSON.stringify({ sid, known }));
  after(async () => {
    const r = await advanceBdRun(BUDGET_MS).catch((e) => ({ error: String(e) }));
    console.log("[bd/webhook] advance", JSON.stringify(r));
  });
  return NextResponse.json({ ok: true, known });
}

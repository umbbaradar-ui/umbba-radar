// ============================================
// /api/admin/cards/auto-publish — 점수 기반 자동 발행 수동 트리거
//   GET : 미리보기(발행하지 않고 후보만 반환)
//   POST: 실행 — pending & pass & 점수 ≥ AUTO_PUBLISH_MIN_SCORE(기본 85) 발행
// 평시엔 매일 09:00 KST cron(/api/cron/notify-deadline)이 자동 실행하므로
// 이 라우트는 테스트·수동 재실행용이다.
// 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키.
// ============================================
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/shared/utils/admin-session";
import { autoPublishReviewedPosts } from "@/modules/curation/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request, execute: boolean) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await autoPublishReviewedPosts(execute);
    return NextResponse.json({ ok: !result.error, executed: execute, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request, false);
}

export async function POST(request: Request) {
  return handle(request, true);
}

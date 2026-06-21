// ============================================
// POST /api/admin/cards/requeue-junk
// 기존 "Vision 실패" 미분류 fallback 카드(status='pending', title에 "Vision 실패")를
// status='draft' 로 되돌려, 분류 루틴(bd_classify.py)이 로컬 Claude로 재분류/정리하게 함.
// Claude 크레딧 소진기에 쌓인 junk 일괄 흡수용 — 일회성(여러 번 호출해도 안전, 멱등).
// 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키.
// ============================================
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { isAdminRequest } from "@/shared/utils/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseServer
    .from("posts")
    .update({ status: "draft" })
    .eq("status", "pending")
    .eq("source_type", "ingestion")
    .like("title", "%Vision 실패%")
    .select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, requeued: data?.length ?? 0 });
}

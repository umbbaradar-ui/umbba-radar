// ============================================
// GET /api/admin/cards/drafts
// 미분류(status='draft') 카드 목록 — 분류 루틴(로컬 Claude)이 읽어 분류할 대상.
// 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키 (admin-session 일원화).
// ============================================
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { isAdminRequest } from "@/shared/utils/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(u.searchParams.get("limit") ?? "200", 10) || 200, 1),
    500
  );
  const { data, error } = await supabaseServer
    .from("posts")
    .select("id, source_url, body, thumbnail_url, created_at")
    .eq("status", "draft")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: data?.length ?? 0, items: data ?? [] });
}

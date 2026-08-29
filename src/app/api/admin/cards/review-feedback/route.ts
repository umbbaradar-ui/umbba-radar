// ============================================
// GET /api/admin/cards/review-feedback
// 사람 결정(승인/반려) vs AI 검수 점수 대조 — 검수자 캘리브레이션 데이터.
// bd_review.py 가 매 실행 전에 읽어 "최근 사람과 어긋난 사례"를 프롬프트에 주입한다
// → 검수자 품질이 사람 피드백으로 계속 좋아지는 루프.
//
// disagreement 기준:
//   - reject   인데 AI 점수 ≥ 80  → AI 과대평가(관대)
//   - approve* 인데 AI 점수 < 60  → AI 과소평가(엄격)
//   - approve_edited(수정 후 발행) → AI가 못 잡은 수정 포인트 존재
// 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키.
// ============================================
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { isAdminRequest } from "@/shared/utils/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FeedbackRow {
  post_id: string | null;
  title: string | null;
  brand_name: string | null;
  ai_review_score: number | null;
  ai_review_status: string | null;
  ai_review_note: string | null;
  human_action: string;
  created_at: string;
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(u.searchParams.get("limit") ?? "40", 10) || 40, 1),
    100
  );

  const { data, error } = await supabaseServer
    .from("review_feedback")
    .select("post_id, title, brand_name, ai_review_score, ai_review_status, ai_review_note, human_action, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    // 테이블 미생성(023 미적용) — 검수 루틴이 죽지 않게 빈 배열로 응답
    return NextResponse.json({
      ok: true,
      stats: {},
      disagreements: [],
      note: `review_feedback 조회 불가(023 미적용?): ${error.message}`,
    });
  }

  const rows = (data ?? []) as FeedbackRow[];
  const stats: Record<string, number> = {};
  for (const r of rows) {
    stats[r.human_action] = (stats[r.human_action] ?? 0) + 1;
  }

  const disagreements = rows
    .filter((r) => {
      const score = r.ai_review_score;
      if (r.human_action === "reject" && typeof score === "number" && score >= 80) return true;
      if (
        r.human_action.startsWith("approve") &&
        typeof score === "number" &&
        score < 60
      )
        return true;
      if (r.human_action === "approve_edited") return true;
      return false;
    })
    .slice(0, limit);

  return NextResponse.json({ ok: true, total: rows.length, stats, disagreements });
}

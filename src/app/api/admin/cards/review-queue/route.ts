// ============================================
// GET /api/admin/cards/review-queue
// 2차 AI 검수 대상 카드 목록 — 맥 검수 루틴(bd_review.py)이 읽는다.
//   scope=pending(기본): status='pending' & 미검수(ai_reviewed_at IS NULL)
//   scope=enrich       : status='published' & 품목(item_categories) 비어있는 카드 — 분류 보정(백필)용
// 각 카드에 dup_candidates(최근 90일 동일 브랜드·제목 유사 카드 최대 3건)를 붙여
// 검수자가 "동일 캠페인 중복" 여부를 판단할 수 있게 한다 (URL 완전일치 dedup의 사각지대 보완).
// 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키.
// ============================================
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { isAdminRequest } from "@/shared/utils/admin-session";
import type { Post } from "@/shared/types/post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DupCandidate {
  id: string;
  title: string;
  status: string;
  created_at: string;
  basis: string; // "brand+title" | "title"
}

function normBrand(b: string | null | undefined): string {
  return (b ?? "").toLowerCase().replace(/\s+/g, "");
}

function titleTokens(t: string | null | undefined): Set<string> {
  return new Set(
    (t ?? "").split(/[^0-9A-Za-z가-힣]+/).filter((w) => w.length >= 2)
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(u.searchParams.get("limit") ?? "60", 10) || 60, 1),
    200
  );
  const scope = u.searchParams.get("scope") === "enrich" ? "enrich" : "pending";

  let query = supabaseServer.from("posts").select("*");
  if (scope === "enrich") {
    query = query
      .eq("status", "published")
      .eq("item_categories", "{}")
      .order("created_at", { ascending: false });
  } else {
    query = query
      .eq("status", "pending")
      .is("ai_reviewed_at", null)
      .order("created_at", { ascending: true });
  }
  const { data, error } = await query.limit(limit);
  if (error) {
    const hint = error.message.includes("ai_reviewed_at")
      ? " (migration 023_ai_review.sql 미적용)"
      : "";
    return NextResponse.json(
      { ok: false, error: error.message + hint },
      { status: 500 }
    );
  }
  const cards = (data ?? []) as Post[];

  // 중복 후보 계산 — 최근 90일 pending+published 대상 (수백 행 규모라 인메모리로 충분)
  let recent: Array<Pick<Post, "id" | "title" | "brand_name" | "status" | "created_at">> = [];
  if (scope === "pending" && cards.length > 0) {
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: recentData } = await supabaseServer
      .from("posts")
      .select("id, title, brand_name, status, created_at")
      .in("status", ["pending", "published"])
      .gte("created_at", since)
      .limit(3000);
    recent = (recentData ?? []) as typeof recent;
  }

  const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const items = cards.map((p) => {
    const myBrand = normBrand(p.brand_name);
    const myTokens = titleTokens(p.title);
    const dups: Array<DupCandidate & { score: number }> = [];
    for (const r of recent) {
      if (r.id === p.id) continue;
      const ov = tokenOverlap(myTokens, titleTokens(r.title));
      const brandMatch = myBrand.length > 0 && myBrand === normBrand(r.brand_name);
      if ((brandMatch && ov >= 0.3) || ov >= 0.65) {
        dups.push({
          id: r.id,
          title: r.title,
          status: r.status,
          created_at: r.created_at,
          basis: brandMatch ? "brand+title" : "title",
          score: ov + (brandMatch ? 0.3 : 0),
        });
      }
    }
    dups.sort((a, b) => b.score - a.score);
    return {
      id: p.id,
      title: p.title,
      brand_name: p.brand_name,
      body: p.body,
      search_keywords: p.search_keywords,
      stage_categories: p.stage_categories,
      type_tags: p.type_tags,
      item_categories: p.item_categories ?? [],
      kind: p.kind,
      topic: p.topic,
      deadline: p.deadline,
      deadline_unknown: p.deadline_unknown,
      has_thumbnail: Boolean(p.thumbnail_url),
      source_type: p.source_type,
      source_url: p.source_url,
      created_at: p.created_at,
      ai_confidence: p.ai_confidence ?? null,
      dup_candidates: dups.slice(0, 3).map(({ score: _s, ...rest }) => rest),
    };
  });

  return NextResponse.json({
    ok: true,
    scope,
    today_kst: todayKst,
    count: items.length,
    items,
  });
}

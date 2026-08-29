// ============================================
// POST /api/admin/cards/review-results
// 2차 AI 검수 결과 저장 — 점수/판정/사유(ai_review_*) + 분류 보정(fixes).
//
// 보정 허용 필드(택소노미만): search_keywords · item_categories · stage_categories
//   · type_tags · brand_name — 전부 화이트리스트/정규화 통과분만 저장.
// status · title · deadline 은 여기서 절대 건드리지 않는다
//   (발행은 자동발행 cron·사람 승인만, 내용 수정은 사람만).
// 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키.
// ============================================
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { isAdminRequest } from "@/shared/utils/admin-session";
import {
  sanitizeItemCategories,
  ACTIVE_STAGE_CATEGORIES,
  ACTIVE_TYPE_TAGS,
} from "@/shared/types/post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReviewFixes {
  search_keywords?: string | null;
  item_categories?: string[];
  stage_categories?: string[];
  type_tags?: string[];
  brand_name?: string | null;
}

interface ReviewItem {
  id: string;
  score?: number;
  review_status?: string;
  note?: string | null;
  fixes?: ReviewFixes;
}

function normalizeKeywords(raw: string): string | null {
  const cleaned = Array.from(
    new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))
  )
    .slice(0, 5)
    .join(",")
    .slice(0, 200);
  return cleaned || null;
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: { items?: ReviewItem[] };
  try {
    body = (await request.json()) as { items?: ReviewItem[] };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "items array required" }, { status: 400 });
  }
  if (items.length > 200) {
    return NextResponse.json({ ok: false, error: "한 번에 200개까지" }, { status: 400 });
  }

  let updated = 0;
  let failed = 0;
  let fixesApplied = 0;
  const errors: Array<{ id: string; message: string }> = [];

  for (const it of items) {
    if (!it.id || typeof it.score !== "number" || !Number.isFinite(it.score)) {
      failed++;
      errors.push({ id: it.id ?? "(missing)", message: "id·score 필수" });
      continue;
    }
    const score = Math.min(Math.max(Math.round(it.score), 0), 100);
    const status =
      it.review_status === "pass" || it.review_status === "warn" || it.review_status === "fail"
        ? it.review_status
        : score >= 85
          ? "pass"
          : score >= 60
            ? "warn"
            : "fail";

    const upd: Record<string, unknown> = {
      ai_review_score: score,
      ai_review_status: status,
      ai_review_note: it.note ? String(it.note).slice(0, 300) : null,
      ai_reviewed_at: new Date().toISOString(),
    };

    // 보정(fixes) — 택소노미 화이트리스트만
    const f = it.fixes;
    if (f && typeof f === "object") {
      let touched = false;
      if ("search_keywords" in f) {
        // null = 오염 키워드 제거(유효한 보정), string = 교체
        upd.search_keywords =
          typeof f.search_keywords === "string" ? normalizeKeywords(f.search_keywords) : null;
        touched = true;
      }
      if (Array.isArray(f.item_categories)) {
        const clean = sanitizeItemCategories(f.item_categories);
        if (clean.length > 0) {
          upd.item_categories = clean;
          touched = true;
        }
      }
      if (Array.isArray(f.stage_categories)) {
        const clean = Array.from(
          new Set(
            f.stage_categories.filter((v) =>
              (ACTIVE_STAGE_CATEGORIES as readonly string[]).includes(v)
            )
          )
        );
        if (clean.length > 0) {
          upd.stage_categories = clean;
          touched = true;
        }
      }
      if (Array.isArray(f.type_tags)) {
        const clean = Array.from(
          new Set(
            f.type_tags.filter((v) => (ACTIVE_TYPE_TAGS as readonly string[]).includes(v))
          )
        );
        if (clean.length > 0) {
          upd.type_tags = clean;
          touched = true;
        }
      }
      if (typeof f.brand_name === "string" && f.brand_name.trim()) {
        upd.brand_name = f.brand_name.trim().slice(0, 60);
        touched = true;
      }
      if (touched) fixesApplied++;
    }

    try {
      const { error } = await supabaseServer
        .from("posts")
        .update(upd)
        .eq("id", it.id)
        .in("status", ["pending", "published"]); // 검수는 상태를 바꾸지 않는다
      if (error) {
        if (error.message.includes("ai_review")) {
          return NextResponse.json(
            {
              ok: false,
              error: `migration 023_ai_review.sql 미적용 — ${error.message}`,
              updated,
              failed: failed + (items.length - updated - failed),
            },
            { status: 500 }
          );
        }
        throw new Error(error.message);
      }
      updated++;
    } catch (e) {
      failed++;
      errors.push({ id: it.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    failed,
    fixes_applied: fixesApplied,
    errors: errors.slice(0, 10),
  });
}

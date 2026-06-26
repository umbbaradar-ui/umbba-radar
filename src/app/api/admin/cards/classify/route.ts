// ============================================
// POST /api/admin/cards/classify
// 분류 루틴(로컬 Claude) 결과로 미분류(draft) 카드를 확정/삭제.
//   skip=true  → 노이즈 → 카드 삭제(DELETE)
//   else       → draft → 'pending' 으로 UPDATE (제목·카테고리·마감 등 채움 → 검수 대기)
// status='draft' 인 카드만 건드림(안전). 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키.
// ============================================
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { isAdminRequest } from "@/shared/utils/admin-session";
import { isPastDeadline } from "@/shared/utils/dday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UNKNOWN_DEADLINE_DAYS = 7;

interface ClassifyItem {
  id: string;
  skip?: boolean;
  title?: string;
  brand_name?: string | null;
  body?: string | null;
  search_keywords?: string | null;
  kind?: "recruiting" | "group_buy";
  stage_categories?: string[];
  type_tags?: string[];
  topic?: "parenting" | "living";
  deadline?: string | null;
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: { items?: ClassifyItem[] };
  try {
    body = (await request.json()) as { items?: ClassifyItem[] };
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
  let deleted = 0;
  let failed = 0;
  const errors: Array<{ id: string; message: string }> = [];

  for (const it of items) {
    if (!it.id) {
      failed++;
      errors.push({ id: "(missing)", message: "id required" });
      continue;
    }
    try {
      // 노이즈 → 삭제 (draft 인 것만)
      if (it.skip) {
        const { error } = await supabaseServer
          .from("posts")
          .delete()
          .eq("id", it.id)
          .eq("status", "draft");
        if (error) throw new Error(error.message);
        deleted++;
        continue;
      }
      if (!it.title) {
        failed++;
        errors.push({ id: it.id, message: "title 필수" });
        continue;
      }
      const deadlineUnknown = !it.deadline;
      let effectiveDeadline: string;
      if (it.deadline) {
        effectiveDeadline = it.deadline;
      } else {
        // 상시(마감 미정) → 원문 게시일 + 7 (없으면 등록일 + 7).
        // 인스타 BD = source_post_date. 컬럼(021) 미생성 시 created_at 폴백(안 깨짐).
        const { data: row, error: selErr } = await supabaseServer
          .from("posts")
          .select("source_post_date, created_at")
          .eq("id", it.id)
          .single();
        let baseIso: string | null = null;
        if (selErr || !row) {
          const { data: row2 } = await supabaseServer
            .from("posts")
            .select("created_at")
            .eq("id", it.id)
            .single();
          baseIso = (row2 as { created_at?: string } | null)?.created_at ?? null;
        } else {
          const r = row as {
            source_post_date?: string | null;
            created_at?: string | null;
          };
          baseIso = r.source_post_date ?? r.created_at ?? null;
        }
        const baseMs = baseIso ? new Date(baseIso).getTime() : Date.now();
        effectiveDeadline = new Date(
          baseMs + UNKNOWN_DEADLINE_DAYS * 86400000
        ).toISOString();
      }
      // 계산된(또는 명시) 마감이 이미 오늘(KST)보다 과거면 발행 대신 마감(expired)
      const computedStatus = isPastDeadline(effectiveDeadline)
        ? "expired"
        : "pending";
      const searchKeywords = it.search_keywords
        ? Array.from(
            new Set(
              it.search_keywords.split(",").map((s) => s.trim()).filter(Boolean)
            )
          )
            .slice(0, 5)
            .join(",")
            .slice(0, 200)
        : null;

      const upd: Record<string, unknown> = {
        status: computedStatus,
        kind: it.kind === "group_buy" ? "group_buy" : "recruiting",
        title: it.title.slice(0, 120),
        brand_name: it.brand_name ?? null,
        search_keywords: searchKeywords,
        deadline: effectiveDeadline,
        deadline_unknown: deadlineUnknown,
        stage_categories: it.stage_categories ?? [],
        type_tags: it.type_tags ?? [],
        topic: it.topic === "living" ? "living" : "parenting",
      };
      // body 는 제공된 경우만 갱신 — 미제공 시 draft 의 원문 캡션 보존(요약/누락 방지)
      if (it.body !== undefined) upd.body = it.body?.slice(0, 2000) ?? null;
      const { error } = await supabaseServer
        .from("posts")
        .update(upd)
        .eq("id", it.id)
        .eq("status", "draft");
      if (error) throw new Error(error.message);
      updated++;
    } catch (e) {
      failed++;
      errors.push({ id: it.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, updated, deleted, failed, errors: errors.slice(0, 50) });
}

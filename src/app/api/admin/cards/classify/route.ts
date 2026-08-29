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
import { sanitizeItemCategories } from "@/shared/types/post";

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
  /** 품목 카테고리 (022) — 화이트리스트 통과분만 저장, 최대 2개 */
  item_categories?: string[];
  topic?: "parenting" | "living";
  deadline?: string | null;
  /** 1차 분류 신뢰도 0~1 (RULES.md confidence — 023 ai_confidence로 저장) */
  confidence?: number;
  /** skip=true 일 때의 사유 — classify_skip_log(023)에 감사 기록 */
  skip_reason?: string;
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
  let pendingCnt = 0;
  let expiredCnt = 0;
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
      // 노이즈 → 삭제 (draft 인 것만). 삭제 전 감사 로그(023 classify_skip_log, best-effort)
      // — 기존엔 흔적 없는 DELETE라 오탐 skip(잘못 버린 혜택) 검증이 불가능했다.
      if (it.skip) {
        try {
          const { data: victim } = await supabaseServer
            .from("posts")
            .select("source_url, body")
            .eq("id", it.id)
            .eq("status", "draft")
            .maybeSingle();
          if (victim) {
            const v = victim as { source_url?: string | null; body?: string | null };
            await supabaseServer.from("classify_skip_log").insert({
              post_id: it.id,
              source_url: v.source_url ?? null,
              reason: it.skip_reason ? String(it.skip_reason).slice(0, 200) : null,
              caption_snippet: (v.body ?? "").slice(0, 200) || null,
            });
          }
        } catch {
          // 감사 로그 실패(023 미적용 등)는 무시 — skip 처리는 계속
        }
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
        item_categories: sanitizeItemCategories(it.item_categories),
        topic: it.topic === "living" ? "living" : "parenting",
      };
      // 1차 분류 신뢰도 저장(023) — 검수 우선순위·품질 지표용 (기존엔 계산 후 폐기되던 값)
      if (typeof it.confidence === "number" && Number.isFinite(it.confidence)) {
        upd.ai_confidence = Math.min(Math.max(it.confidence, 0), 1);
      }
      // body 는 제공된 경우만 갱신 — 미제공 시 draft 의 원문 캡션 보존(요약/누락 방지)
      if (it.body !== undefined) upd.body = it.body?.slice(0, 2000) ?? null;
      let { error } = await supabaseServer
        .from("posts")
        .update(upd)
        .eq("id", it.id)
        .eq("status", "draft");
      // 마이그레이션 022 미적용 DB — 품목만 빼고 재시도 (021 source_post_date와 동일 패턴)
      if (error && error.message.includes("item_categories")) {
        delete upd.item_categories;
        ({ error } = await supabaseServer
          .from("posts")
          .update(upd)
          .eq("id", it.id)
          .eq("status", "draft"));
      }
      // 마이그레이션 023 미적용 DB — 신뢰도만 빼고 재시도
      if (error && error.message.includes("ai_confidence")) {
        delete upd.ai_confidence;
        ({ error } = await supabaseServer
          .from("posts")
          .update(upd)
          .eq("id", it.id)
          .eq("status", "draft"));
      }
      if (error) throw new Error(error.message);
      updated++;
      if (computedStatus === "expired") expiredCnt++;
      else pendingCnt++;
    } catch (e) {
      failed++;
      errors.push({ id: it.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, updated, pending: pendingCnt, expired: expiredCnt, deleted, failed, errors: errors.slice(0, 50) });
}

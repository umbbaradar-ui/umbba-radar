// ============================================
// POST /api/admin/cards/review-results
// 2차 AI 검수 결과 저장 — 점수/판정/사유(ai_review_*) + 분류 보정(fixes).
//
// 보정 허용 필드(택소노미): search_keywords · item_categories · stage_categories
//   · type_tags · brand_name — 전부 화이트리스트/정규화 통과분만 저장.
// deadline: 2026-09-08부터 허용 — 단 캡션(body)에 그 날짜가 실제로 적혀 있을 때만.
//   전수조사에서 마감미정의 21%가 캡션에 근거가 있는데도 놓친 것으로 확인돼,
//   기계적으로 확인 가능한 이 보정만 AI에게 열었다. 근거 대조는 서버가 다시 한다
//   (verifyDeadline) — 모델 말만 믿고 쓰지 않는다. 통과 시 deadline_unknown=false.
//   2026-09-11: 마감미정이었던 카드는 AI가 마감을 채웠어도 자동 발행하지 않는다 —
//   판정을 warn(≤84)으로 캡해 승인 큐에 남긴다. 사람은 채워진 날짜만 확인하고 발행.
// topic (2026-09-10) — 어른 제품이 parenting 이면 living 으로. 2026-09-12부터 최종 topic 이
//   living 이면 서버가 시기=['all_ages']·품목=리빙 5종으로 함께 맞춘다(enforceTopicTaxonomy).
// status · title · body 는 여기서 절대 건드리지 않는다
//   (발행은 자동발행 cron·사람 승인만, 내용 수정은 사람만).
// 인증: Bearer ADMIN_CLI_TOKEN 또는 어드민 쿠키.
// ============================================
import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { isAdminRequest } from "@/shared/utils/admin-session";
import {
  sanitizeItemCategories,
  enforceTopicTaxonomy,
  ACTIVE_STAGE_CATEGORIES,
  ACTIVE_TYPE_TAGS,
  type ItemCategory,
  type StageCategory,
  type TopicCategory,
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
  deadline?: string | null;
  /** 탭 보정 (2026-09-10): 어른 제품이 parenting으로 분류된 경우 living으로 */
  topic?: "parenting" | "living";
}

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * KST 기준 월/일을 캡션 표기 후보로 (공백 제거된 캡션과 대조용).
 * 월 없는 "13일" 형태는 캡션이 게시월을 생략한 경우라 **게시월과 같은 달일 때만** 인정한다.
 * (아무 달에나 허용하면 캡션에 우연히 있는 숫자로 엉뚱한 날짜가 통과된다)
 */
function dateTokens(instant: Date, postedMonth: number | null): string[] {
  const kst = new Date(instant.getTime() + KST_OFFSET_MS);
  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const toks = [`${m}/${d}`, `${mm}/${dd}`, `${m}.${d}`, `${m}월${d}일`];
  if (postedMonth === null || postedMonth === m) toks.push(`${d}일`);
  return toks;
}

/**
 * AI가 제안한 마감일 검증 — 캡션에 근거가 있을 때만 통과.
 * "당첨자 발표 9/14 → 마감 9/13" 역산을 쓰므로, 마감일 당일 또는 다음날(발표일) 중
 * 하나가 캡션에 표기돼 있으면 근거 있음으로 본다. 없으면 버리고 마감미정을 유지한다
 * (= 사람 검수 큐에 그대로 남음). 모델이 지어낸 날짜를 막는 마지막 관문.
 */
function verifyDeadline(
  raw: string,
  body: string,
  postedAt: string | null
): { ok: true; value: string } | { ok: false; why: string } {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { ok: false, why: "날짜 형식 오류" };
  const base = postedAt ? new Date(postedAt) : null;
  if (base && !Number.isNaN(base.getTime())) {
    if (d.getTime() < base.getTime() - DAY_MS)
      return { ok: false, why: "마감이 게시일보다 과거" };
    if (d.getTime() > base.getTime() + 180 * DAY_MS)
      return { ok: false, why: "마감이 게시일+180일 초과" };
  }
  const text = (body ?? "").replace(/\s+/g, "");
  const postedMonth =
    base && !Number.isNaN(base.getTime())
      ? new Date(base.getTime() + KST_OFFSET_MS).getUTCMonth() + 1
      : null;
  const cited = [d, new Date(d.getTime() + DAY_MS)].some((c) =>
    dateTokens(c, postedMonth).some((tok) => text.includes(tok))
  );
  if (!cited) return { ok: false, why: "캡션에 해당 날짜 표기 없음" };
  return { ok: true, value: d.toISOString() };
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
  let deadlineFixes = 0;
  let deadlineRejected = 0;
  const errors: Array<{ id: string; message: string }> = [];

  // 리빙 불변식(시기=전연령 단독·품목=리빙 5종)을 지키려면 카드의 현재 topic·시기·품목이 필요하다
  // — 검수가 topic 만 living 으로 고치고 시기는 안 건드리는 경우가 흔해서, 배치 전체를 한 번에 읽는다.
  const current = new Map<
    string,
    { topic: TopicCategory; stage: StageCategory[]; items: ItemCategory[] }
  >();
  {
    const ids = items.filter((it) => it?.id).map((it) => it.id).slice(0, 200);
    const { data: curRows } = await supabaseServer
      .from("posts")
      .select("id, topic, stage_categories, item_categories")
      .in("id", ids);
    for (const r of (curRows ?? []) as Array<{
      id: string;
      topic: string | null;
      stage_categories: string[] | null;
      item_categories: string[] | null;
    }>) {
      current.set(r.id, {
        topic: r.topic === "living" ? "living" : "parenting",
        stage: (r.stage_categories ?? []) as StageCategory[],
        items: (r.item_categories ?? []) as ItemCategory[],
      });
    }
  }

  // 마감일 보정을 제안한 카드만 원문 캡션을 한 번에 읽어 근거 대조에 쓴다.
  const wantDeadline = items
    .filter((it) => it?.id && typeof it.fixes?.deadline === "string")
    .map((it) => it.id);
  const captions = new Map<
    string,
    { body: string; postedAt: string | null; wasUnknown: boolean }
  >();
  if (wantDeadline.length > 0) {
    const { data: capRows } = await supabaseServer
      .from("posts")
      .select("id, body, source_post_date, created_at, deadline_unknown")
      .in("id", wantDeadline.slice(0, 200));
    for (const r of (capRows ?? []) as Array<{
      id: string;
      body: string | null;
      source_post_date: string | null;
      created_at: string | null;
      deadline_unknown: boolean | null;
    }>) {
      captions.set(r.id, {
        body: r.body ?? "",
        postedAt: r.source_post_date ?? r.created_at,
        wasUnknown: Boolean(r.deadline_unknown),
      });
    }
  }

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
      if (f.topic === "parenting" || f.topic === "living") {
        upd.topic = f.topic;
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
      if (typeof f.deadline === "string" && f.deadline.trim()) {
        const cap = captions.get(it.id);
        const v = verifyDeadline(f.deadline.trim(), cap?.body ?? "", cap?.postedAt ?? null);
        if (v.ok) {
          upd.deadline = v.value;
          upd.deadline_unknown = false;
          deadlineFixes++;
          touched = true;
          if (cap?.wasUnknown && status === "pass") {
            // 마감미정이었던 카드는 사람이 한 번 본다 — pass 를 warn 으로 내려 자동 발행 차단
            upd.ai_review_status = "warn";
            upd.ai_review_score = Math.min(score, 84);
          }
        } else {
          // 근거 없는 제안은 버린다 — 마감미정을 유지해 사람 검수로 남긴다.
          deadlineRejected++;
          errors.push({ id: it.id, message: `마감일 보정 거절: ${v.why}` });
        }
      }
      if (touched) fixesApplied++;
    }

    // 최종 topic 이 living 이면(보정으로 바뀌었든 원래 그랬든) 시기·품목을 리빙 불변식으로 맞춘다.
    // 검수가 living 으로 고치면서 시기를 안 건드려 "living + 영아"가 남는 구멍을 여기서 막는다.
    {
      const cur = current.get(it.id);
      const effTopic: TopicCategory =
        (upd.topic as TopicCategory | undefined) ?? cur?.topic ?? "parenting";
      if (effTopic === "living") {
        const tax = enforceTopicTaxonomy({
          topic: "living",
          stage_categories: (upd.stage_categories as string[] | undefined) ?? cur?.stage ?? [],
          item_categories: (upd.item_categories as string[] | undefined) ?? cur?.items ?? [],
        });
        upd.stage_categories = tax.stage_categories;
        upd.item_categories = tax.item_categories;
      }
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
    deadline_fixes: deadlineFixes,
    deadline_rejected: deadlineRejected,
    errors: errors.slice(0, 10),
  });
}

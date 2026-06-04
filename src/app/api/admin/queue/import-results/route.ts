// ============================================
// 로컬 분석 모드 — POST /api/admin/queue/import-results
// Claude Code 가 만든 results JSON 받아서 posts 일괄 생성 (API 호출 0)
//
// Body 형식:
//   {
//     items: [
//       {
//         queue_id: "<uuid>",          // 큐 항목 매칭
//         skip?: true,                  // 카드 생성 안 함 (노이즈 표시)
//         skip_reason?: string,         // 스킵 사유 (로깅용)
//         title?: string,
//         brand_name?: string | null,
//         body?: string | null,
//         search_keywords?: string | null,
//         kind?: "recruiting" | "group_buy",
//         stage_categories?: string[],
//         type_tags?: string[],
//         topic?: "parenting" | "living",
//         deadline?: string | null,    // ISO 8601 +09:00
//         thumbnail_url?: string | null, // C 모드: Storage URL
//         confidence?: number
//       }
//     ]
//   }
//
// 동작:
//   - skip=true: ingest_queue status='duplicate' 같이 처리하지 않음. status='failed' 로 표시
//     (또는 별도 status='skipped' — 일단 'duplicate' 재활용)
//   - 정상: posts INSERT(status='pending') + ingest_queue status='done'+post_id
//
// 인증: 어드민 cookie
// ============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/shared/db/supabase-server";
import { markDone, markFailed } from "@/modules/ingestion/queue/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_COOKIE = "umbba-admin";

/**
 * 어드민 cookie (웹 UI) 또는 Bearer ADMIN_CLI_TOKEN (CLI) 둘 다 허용
 */
async function isAuthorized(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization");
  if (auth) {
    const expected = process.env.ADMIN_CLI_TOKEN;
    return Boolean(expected && auth === `Bearer ${expected}`);
  }
  const cookieToken = (await cookies()).get(ADMIN_COOKIE)?.value;
  const adminPw = process.env.ADMIN_PASSWORD;
  return Boolean(adminPw && cookieToken && cookieToken === adminPw);
}

interface ImportItem {
  queue_id: string;
  skip?: boolean;
  skip_reason?: string;
  title?: string;
  brand_name?: string | null;
  body?: string | null;
  search_keywords?: string | null;
  kind?: "recruiting" | "group_buy";
  stage_categories?: string[];
  type_tags?: string[];
  topic?: "parenting" | "living";
  deadline?: string | null;
  thumbnail_url?: string | null;
  confidence?: number;
}

interface RequestBody {
  items: ImportItem[];
}

const UNKNOWN_DEADLINE_DAYS = 7;

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { ok: false, error: "items array required" },
      { status: 400 }
    );
  }
  if (body.items.length > 200) {
    return NextResponse.json(
      { ok: false, error: "한 번에 200개까지" },
      { status: 400 }
    );
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ queue_id: string; message: string }> = [];

  for (const item of body.items) {
    if (!item.queue_id) {
      failed++;
      errors.push({ queue_id: "(missing)", message: "queue_id required" });
      continue;
    }

    // 큐 항목에서 source_url(인스타 url) 받아오기
    const { data: queueRow, error: queueErr } = await supabaseServer
      .from("ingest_queue")
      .select("id, url, status")
      .eq("id", item.queue_id)
      .maybeSingle();
    if (queueErr || !queueRow) {
      failed++;
      errors.push({
        queue_id: item.queue_id,
        message: queueErr?.message ?? "큐 항목 없음",
      });
      continue;
    }
    if (queueRow.status !== "todo") {
      // 이미 처리됐거나 실패 — 스킵
      failed++;
      errors.push({
        queue_id: item.queue_id,
        message: `이미 ${queueRow.status} 상태`,
      });
      continue;
    }

    // skip 표시면 큐만 마킹하고 카드 X
    if (item.skip) {
      try {
        await markFailed(
          item.queue_id,
          `[로컬분석] skip: ${item.skip_reason ?? "노이즈"}`
        );
        skipped++;
      } catch (e) {
        failed++;
        errors.push({
          queue_id: item.queue_id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      continue;
    }

    // 필수 필드 검증
    if (!item.title) {
      failed++;
      errors.push({ queue_id: item.queue_id, message: "title 필수" });
      continue;
    }

    // 이미 같은 source_url 카드 있는지 (중복 보호)
    const { data: existingPost } = await supabaseServer
      .from("posts")
      .select("id")
      .eq("source_url", queueRow.url)
      .maybeSingle();
    if (existingPost) {
      try {
        await markDone(item.queue_id, (existingPost as { id: string }).id);
        skipped++;
      } catch (e) {
        failed++;
        errors.push({
          queue_id: item.queue_id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      continue;
    }

    // deadline_unknown 처리
    const deadlineUnknown = !item.deadline;
    const effectiveDeadline = deadlineUnknown
      ? new Date(Date.now() + UNKNOWN_DEADLINE_DAYS * 86400000).toISOString()
      : item.deadline;

    // search_keywords 정제
    const searchKeywords = item.search_keywords
      ? Array.from(
          new Set(
            item.search_keywords
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        )
          .slice(0, 5)
          .join(",")
          .slice(0, 200)
      : null;

    const { data: inserted, error: insertError } = await supabaseServer
      .from("posts")
      .insert({
        kind: item.kind === "group_buy" ? "group_buy" : "recruiting", // 공구 명시 시 group_buy, 기본 recruiting
        title: item.title.slice(0, 120),
        brand_name: item.brand_name ?? null,
        thumbnail_url: item.thumbnail_url ?? null,
        source_url: queueRow.url,
        body: item.body?.slice(0, 2000) ?? null,
        search_keywords: searchKeywords,
        deadline: effectiveDeadline,
        deadline_unknown: deadlineUnknown,
        stage_categories: item.stage_categories ?? [],
        type_tags: item.type_tags ?? [],
        topic: item.topic === "living" ? "living" : "parenting",
        is_sponsored: false,
        status: "pending" as const,
        source_type: "ingestion" as const,
      })
      .select("id")
      .single();

    if (insertError) {
      failed++;
      errors.push({
        queue_id: item.queue_id,
        message: insertError.message,
      });
      try {
        await markFailed(
          item.queue_id,
          `[로컬분석] insert 실패: ${insertError.message}`
        );
      } catch {}
      continue;
    }

    const postId = (inserted as { id: string }).id;
    try {
      await markDone(item.queue_id, postId);
      created++;
    } catch (e) {
      failed++;
      errors.push({
        queue_id: item.queue_id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    failed,
    errors: errors.slice(0, 50),
  });
}

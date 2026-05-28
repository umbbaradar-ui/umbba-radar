// ============================================
// 로컬 분석 모드 — GET /api/admin/queue/export-todo
// todo 상태인 큐 항목들을 JSON 으로 export (Claude Code 가 분류할 입력)
//
// 흐름:
//   1. 사용자가 어드민에서 [Export] 버튼 클릭
//   2. 브라우저가 todo-YYYYMMDD.json 다운로드
//   3. Claude Code 에 그 파일 던지고 "RULES.md 보고 분류해줘"
//   4. Claude Code 가 results.json 생성 → import endpoint 로 업로드
//
// 인증: 어드민 cookie
// ============================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listQueue } from "@/modules/ingestion/queue/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_COOKIE = "umbba-admin";

export async function GET() {
  const expected = process.env.ADMIN_PASSWORD;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // todo 상태만 필터
  const all = await listQueue(500);
  const todos = all.filter((q) => q.status === "todo");

  const payload = {
    exported_at: new Date().toISOString(),
    count: todos.length,
    // Claude Code 가 읽고 처리할 형식
    items: todos.map((q) => ({
      queue_id: q.id,
      url: q.url,
      source_username: q.source_username,
      source_post_date: q.source_post_date,
      caption: q.caption_preview,
    })),
    // Claude Code 에게 줄 가이드 (RULES.md 와 함께 사용)
    instructions: [
      "각 item 을 분석해 카드 메타데이터를 채워주세요.",
      "결과는 results.items 배열에 같은 queue_id 로 매핑.",
      "분류 기준은 RULES.md 참조.",
      "모집·체험단·이벤트 아닌 일상글은 skip: true 로 표시 (카드 생성 X).",
      "신뢰도 0.5 미만이면 너님(사용자)에게 한 번 확인 받고 결정.",
    ],
  };

  const filename = `todo-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

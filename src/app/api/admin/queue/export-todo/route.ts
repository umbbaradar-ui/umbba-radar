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

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // todo 상태만 필터 (3일 이상 옛 항목도 포함하려 withinDays 크게)
  const all = await listQueue(500, 30);
  const todos = all.filter((q) => q.status === "todo");

  // KST 기준 today (Claude 가 이벤트 만료 판단 시 사용)
  const nowKST = new Date(Date.now() + 9 * 3600000);
  const todayKST = nowKST.toISOString().slice(0, 10); // YYYY-MM-DD

  const payload = {
    exported_at: new Date().toISOString(),
    today_kst: todayKST,
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
      "** 검수는 너님(Claude)이 책임 ** — RULES.md 의 'skip 적극 판단' 섹션 따라 노이즈는 무조건 skip:true.",
      `오늘 날짜(KST) = ${todayKST}. 이 날짜 기준으로 이벤트 만료 여부 판단.`,
      "신뢰도 0.5 미만이라도 명백한 노이즈면 skip 으로 처리 (사용자 확인 X).",
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

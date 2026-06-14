// ============================================
// POST /api/track — 클라이언트 트래킹 이벤트 수신
// ============================================

import { NextResponse } from "next/server";
import { insertEvent } from "@/modules/analytics/repository";
import { getServerSupabase } from "@/shared/db/supabase-ssr";

interface Body {
  event_name?: string;
  anon_id?: string;
  post_id?: string | null;
  properties?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    // 입력 검증 — 무인증 공개 엔드포인트라 남용(DB 폭주·임의 대용량 JSONB) 방지
    const eventName = body.event_name;
    if (
      !eventName ||
      typeof eventName !== "string" ||
      eventName.length > 64 ||
      !/^[a-z0-9_]+$/i.test(eventName)
    ) {
      return NextResponse.json({ ok: false, error: "invalid event_name" }, { status: 400 });
    }
    const props =
      body.properties && typeof body.properties === "object" ? body.properties : {};
    if (JSON.stringify(props).length > 2048) {
      return NextResponse.json({ ok: false, error: "properties too large" }, { status: 400 });
    }
    const anonId =
      typeof body.anon_id === "string" && body.anon_id.length <= 64 ? body.anon_id : null;
    const postId =
      typeof body.post_id === "string" && body.post_id.length <= 64 ? body.post_id : null;

    // 로그인 사용자라면 user_id도 함께
    let userId: string | null = null;
    try {
      const supabase = await getServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // 로그인 안 됨이거나 OAuth 미설정 — 익명으로 계속
    }

    await insertEvent({
      event_name: eventName,
      user_id: userId,
      anon_id: anonId,
      post_id: postId,
      properties: props,
      user_agent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[track] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

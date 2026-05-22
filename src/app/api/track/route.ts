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

    if (!body.event_name || typeof body.event_name !== "string") {
      return NextResponse.json({ ok: false, error: "missing event_name" }, { status: 400 });
    }

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
      event_name: body.event_name,
      user_id: userId,
      anon_id: body.anon_id ?? null,
      post_id: body.post_id ?? null,
      properties: body.properties ?? {},
      user_agent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[track] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

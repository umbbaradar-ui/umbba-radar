// ============================================
// Analytics Repository — events 테이블 직접 접근 (서버 전용)
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";

export interface EventInsertInput {
  event_name: string;
  user_id?: string | null;
  anon_id?: string | null;
  post_id?: string | null;
  properties?: Record<string, unknown>;
  user_agent?: string | null;
  referer?: string | null;
}

export async function insertEvent(input: EventInsertInput): Promise<void> {
  const { error } = await supabaseServer.from("events").insert({
    event_name: input.event_name,
    user_id: input.user_id ?? null,
    anon_id: input.anon_id ?? null,
    post_id: input.post_id ?? null,
    properties: input.properties ?? {},
    user_agent: input.user_agent ?? null,
    referer: input.referer ?? null,
  });
  if (error) {
    // 트래킹 실패가 UX를 깨지 않게 — 콘솔에만 남김
    console.error("[analytics] insertEvent failed:", error.message);
  }
}

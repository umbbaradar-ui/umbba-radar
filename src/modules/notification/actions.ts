"use server";

// ============================================
// Push 구독 Server Actions — 클라이언트의 토글이 호출
// ============================================

import { getServerSupabase } from "@/shared/db/supabase-ssr";
import { saveSubscription, removeSubscription } from "./push-service";

/**
 * 브라우저에서 받은 PushSubscription을 직렬화해 전달받고 DB 저장.
 * 로그인 안 됐으면 거부.
 */
export async function subscribePushAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  return saveSubscription(
    user.id,
    {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    input.userAgent ?? null
  );
}

/** 구독 해지 — endpoint 단위 */
export async function unsubscribePushAction(
  endpoint: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요해요" };

  return removeSubscription(user.id, endpoint);
}

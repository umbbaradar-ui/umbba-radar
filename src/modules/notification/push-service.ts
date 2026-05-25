// ============================================
// Web Push 발송 + 구독 저장/해지 (server-only)
//
// 책임:
//   - VAPID 키로 web-push 초기화
//   - push_subscriptions 테이블 read/write (service_role)
//   - 발송 시 410 Gone(구독 만료) 응답이면 자동 정리
// ============================================

import "server-only";
import webpush from "web-push";
import { supabaseServer } from "@/shared/db/supabase-server";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@umbba-radar.com";

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    // env 미설정 시: dev 환경에서 조용히 비활성, production은 발송 시점에 fail-safe
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** 클릭 시 이동 (예: "/post/abc-123"). 없으면 sw.js 기본값 사용 */
  url?: string;
  /** 같은 tag면 새 알림이 기존 알림 대체. 마감 알림은 카드별 다른 tag 권장 */
  tag?: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * 사용자가 브라우저에서 받은 PushSubscription을 DB에 저장.
 * 이미 같은 endpoint 있으면 last_active_at 갱신 (upsert).
 */
export async function saveSubscription(
  userId: string,
  sub: StoredSubscription,
  userAgent: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        user_agent: userAgent ?? null,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 구독 해지 — endpoint 단위로 제거 */
export async function removeSubscription(
  userId: string,
  endpoint: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 특정 user의 활성 구독 전부 조회 */
export async function getSubscriptionsForUser(
  userId: string
): Promise<StoredSubscription[]> {
  const { data, error } = await supabaseServer
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data as StoredSubscription[];
}

/** 여러 user의 활성 구독 전부 (cron 배치 발송용) */
export async function getSubscriptionsForUsers(
  userIds: string[]
): Promise<Array<StoredSubscription & { user_id: string }>> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabaseServer
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error || !data) return [];
  return data as Array<StoredSubscription & { user_id: string }>;
}

/**
 * 구독 1건에 push 발송.
 * 410(Gone) 또는 404 → 구독 만료 → DB에서 자동 제거.
 * 그 외 오류는 로그만 남기고 무시 (한 명 실패해도 다른 사람 발송 계속).
 */
export async function sendToSubscription(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  if (!ensureVapid()) {
    return { ok: false, error: "VAPID env not configured" };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // 만료된 구독 — 자동 정리
      await supabaseServer
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", sub.endpoint);
      return { ok: false, gone: true };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[push] send failed:", statusCode, message);
    return { ok: false, error: message };
  }
}

/**
 * 한 user에게 발송 (그 user의 모든 디바이스 구독에 동시 발송).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; gone: number; failed: number }> {
  const subs = await getSubscriptionsForUser(userId);
  return sendToMany(subs, payload);
}

/** 구독 배열에 일괄 발송 + 통계 반환 */
export async function sendToMany(
  subs: StoredSubscription[],
  payload: PushPayload
): Promise<{ sent: number; gone: number; failed: number }> {
  let sent = 0;
  let gone = 0;
  let failed = 0;
  const results = await Promise.all(
    subs.map((s) => sendToSubscription(s, payload))
  );
  for (const r of results) {
    if (r.ok) sent++;
    else if (r.gone) gone++;
    else failed++;
  }
  return { sent, gone, failed };
}

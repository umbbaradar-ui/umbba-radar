// ============================================
// 푸시 구독 클라이언트 유틸 — 브라우저 전용 (PushSettings 모달 · PushPromptSheet 공용)
//
// 2026-10 PushPromptSheet(관심 직후 권유) 도입 시 PushSettings 안에 있던
// 상태 감지·권한 요청·구독 저장 로직을 그대로 옮겨 공유한다. 동작은 동일.
// ============================================

import { subscribePushAction } from "./actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PREF_KEY = "umbba-radar:push-categories";

export const PUSH_CATEGORY_IDS = ["deadline", "new", "my_child", "tips"] as const;

export type PushStatus =
  | "loading"
  | "unsupported"
  | "ios-not-installed"
  | "permission-denied"
  | "ready" // 지원됨 · 아직 꺼짐
  | "on" // 구독 중
  | "working";

// ============================================
// 상태 감지
// ============================================
export async function detectPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "loading";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    if (isIosSafari()) return "ios-not-installed";
    return "unsupported";
  }
  const permission = Notification.permission;
  if (permission === "denied") return "permission-denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub && permission === "granted") return "on";
    return "ready";
  } catch {
    return "ready";
  }
}

/**
 * 빠른 상태 감지 — 권유 시트용.
 * detectPushStatus 는 `serviceWorker.ready` 를 기다리는데, SW 미등록(dev·등록 실패)이면
 * 영영 resolve 되지 않는다. 권유 판단은 등록 여부만 보면 되니 getRegistration() 사용.
 */
export async function detectPushStatusQuick(): Promise<PushStatus> {
  if (typeof window === "undefined") return "loading";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    if (isIosDevice() && !isStandalone()) return "ios-not-installed";
    return "unsupported";
  }
  const permission = Notification.permission;
  if (permission === "denied") return "permission-denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub && permission === "granted") return "on";
    return "ready";
  } catch {
    return "ready";
  }
}

// ============================================
// 켜기 — 권한 요청 → 선호 저장 → (VAPID 있으면) 구독 + 서버 저장
// 반환: 최종 권한. 구독 단계 실패(VAPID 미설정·미로그인)는 조용히 무시 — 권한·선호는 저장됨.
// ============================================
export async function enablePushOnThisDevice(
  categories: string[] = loadPushPref()
): Promise<{ permission: NotificationPermission; subscribed: boolean }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { permission, subscribed: false };
  savePushPref(categories);
  let subscribed = false;
  try {
    if (VAPID_PUBLIC_KEY) {
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const p = serializeSubscription(sub);
      const res = await subscribePushAction({
        ...p,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      subscribed = res.ok;
    }
  } catch {
    // 구독 단계 실패 — 권한·선호는 이미 저장됨.
  }
  return { permission, subscribed };
}

// ============================================
// 선호(항목) 저장 — localStorage (서버 동기화는 발송 도입 시 후속)
// ============================================
export function loadPushPref(): string[] {
  const all = [...PUSH_CATEGORY_IDS] as string[];
  if (typeof window === "undefined") return all;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return all;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    return all;
  } catch {
    return all;
  }
}

export function savePushPref(categories: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(categories));
  } catch {
    // 무시
  }
}

// ============================================
// 환경 판별
// ============================================
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  return isIos && isSafari;
}

/** iOS 기기 (인앱 웹뷰·크롬 포함) */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches === true
  );
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    view[i] = rawData.charCodeAt(i);
  }
  return view;
}

function serializeSubscription(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

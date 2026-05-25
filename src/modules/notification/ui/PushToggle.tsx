"use client";

// ============================================
// 푸시 알림 토글 — 권한 요청 + 구독 등록·해지
//
// 흐름:
//   1. 마운트 시 브라우저 지원 여부 + 현재 구독 상태 감지
//   2. 사용자 토글 ON → Notification.requestPermission → pushManager.subscribe
//      → 서버에 endpoint·p256dh·auth 저장
//   3. 토글 OFF → pushManager 구독 해지 + 서버 DB 제거
//
// 안전 장치:
//   - 미지원 브라우저 → 안내만 노출
//   - iOS Safari + iOS 16.4 미만 → "홈 화면 추가 + iOS 업데이트" 안내
//   - 권한 거부 상태 → "브라우저 설정에서 알림 허용" 안내
// ============================================

import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "../actions";

interface Props {
  /** SSR로 미리 받아서 토글 깜빡임 방지 (선택) */
  vapidPublicKey: string;
}

type Status =
  | "loading"
  | "unsupported"
  | "ios-not-installed" // iOS Safari + PWA 미설치
  | "permission-denied"
  | "off"
  | "on"
  | "working";

export function PushToggle({ vapidPublicKey }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    detectStatus().then(setStatus);
  }, []);

  async function handleToggle() {
    setError(null);
    if (status === "off") {
      await enable();
    } else if (status === "on") {
      await disable();
    }
  }

  async function enable() {
    setStatus("working");
    try {
      // 1. 권한 요청
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "permission-denied" : "off");
        return;
      }

      // 2. SW 구독
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      // 3. 서버 저장
      const payload = serializeSubscription(sub);
      const res = await subscribePushAction({
        ...payload,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (!res.ok) {
        setError(res.error ?? "저장에 실패했어요");
        // 서버 저장 실패 시 SW 구독은 유지 (재시도 가능)
        setStatus("off");
        return;
      }
      setStatus("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("off");
    }
  }

  async function disable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("on");
    }
  }

  // ============================================
  // 렌더링
  // ============================================
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            🔔 푸시 알림
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            관심 표시한 카드의 마감이 임박하면 폰으로 알려드려요.
          </p>
        </div>
        {(status === "off" ||
          status === "on" ||
          status === "working") && (
          <ToggleButton
            isOn={status === "on"}
            isWorking={status === "working"}
            onClick={handleToggle}
          />
        )}
      </header>

      {/* 상태별 안내 */}
      {status === "loading" && (
        <p className="text-[11px] text-slate-400">상태 확인 중…</p>
      )}
      {status === "unsupported" && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          이 브라우저는 푸시 알림을 지원하지 않아요.
        </p>
      )}
      {status === "ios-not-installed" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          iOS는 <strong>홈 화면에 추가</strong>한 뒤 켤 수 있어요.
          (iOS 16.4 이상 + Safari → 공유 → 홈 화면에 추가)
        </p>
      )}
      {status === "permission-denied" && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-700">
          알림이 차단돼 있어요. 브라우저 설정 → 사이트 알림에서
          <strong> umbba-radar.com</strong>을 허용해주세요.
        </p>
      )}
      {status === "on" && !error && (
        <p className="text-[11px] text-emerald-600">
          ✓ 알림 받는 중 — 마감 1일 전 카드가 도착하면 알려드려요.
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}

// ============================================
// 상태 감지 (브라우저 측)
// ============================================
async function detectStatus(): Promise<Status> {
  if (typeof window === "undefined") return "loading";

  // 1. 서비스 워커·푸시 지원 여부
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    // iOS Safari에서는 PWA 설치 안 했으면 PushManager 자체가 없음
    if (isIosSafari()) return "ios-not-installed";
    return "unsupported";
  }

  // 2. 권한 상태
  const permission = Notification.permission;
  if (permission === "denied") return "permission-denied";

  // 3. 현재 구독 중인지
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub && permission === "granted") return "on";
    return "off";
  } catch {
    return "off";
  }
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  return isIos && isSafari;
}

// ============================================
// SubscriptionKey 변환 — VAPID public key (base64url) → BufferSource
// (브라우저 pushManager.subscribe가 요구하는 형식)
//
// 명시적 ArrayBuffer로 만드는 이유: ES2024 lib.dom 타입에서
// Uint8Array<ArrayBufferLike>가 BufferSource에 직접 호환되지 않는 케이스 회피.
// ============================================
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

// ============================================
// PushSubscription → 서버 저장용 형식 (endpoint + 두 키)
// ============================================
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

// ============================================
// 토스 스타일 토글 버튼
// ============================================
function ToggleButton({
  isOn,
  isWorking,
  onClick,
}: {
  isOn: boolean;
  isWorking: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isWorking}
      role="switch"
      aria-checked={isOn}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
        isOn ? "bg-rose-500" : "bg-slate-300"
      } ${isWorking ? "opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          isOn ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

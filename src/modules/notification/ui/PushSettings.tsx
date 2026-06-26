"use client";

// ============================================
// 푸시 알림 설정 — 더보기 시트/유도 배너에서 진입하는 모달.
// 상단 "이 기기에서 알림 받기" 마스터 토글 + "받을 알림 종류" 종류별 토글.
// 직관적 ON/OFF (토스 스타일 스위치).
//
// 현재: 발송 인프라(VAPID·발송 cron) 순차 도입 중 → 구독이 실패해도 권한·선호는
//       저장하고 "곧 시작" 안내. VAPID 켜지면 그대로 동작.
//
// ⚠️ 모달은 createPortal(body) — 시트 transform/헤더 backdrop-blur 회피.
// ============================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { subscribePushAction, unsubscribePushAction } from "../actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PREF_KEY = "umbba-radar:push-categories";
const PROMO_DISMISS_KEY = "umbba-radar:push-promo-dismissed";

const CATEGORIES = [
  { id: "deadline", emoji: "⏰", label: "마감 임박", desc: "관심 카드 마감 1일 전 알려드려요" },
  { id: "new", emoji: "🎁", label: "새 협찬·체험단", desc: "새 혜택이 올라오면 알려드려요" },
  { id: "my_child", emoji: "💛", label: "내 아이 맞춤", desc: "우리 아이 시기 맞춤 혜택" },
  { id: "tips", emoji: "💡", label: "후기·꿀팁", desc: "엄빠 꿀정보를 알려드려요" },
] as const;

const ALL_IDS = CATEGORIES.map((c) => c.id);

type Status =
  | "loading"
  | "unsupported"
  | "ios-not-installed"
  | "permission-denied"
  | "ready" // 지원됨 · 아직 꺼짐
  | "on" // 구독 중
  | "working";

// ============================================
// 진입 버튼 (더보기 시트 안)
// ============================================
export function PushSettingsEntry({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);

  function handle() {
    onOpen?.();
    setTimeout(() => setOpen(true), 320);
  }

  return (
    <>
      <button
        type="button"
        onClick={handle}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
      >
        <span aria-hidden="true" className="text-base">
          🔔
        </span>
        <span>푸시 알림 설정</span>
      </button>
      {open && <PushSettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ============================================
// 유도 배너 — /notifications·/my 등에서 푸시 켜기 권유.
// 이미 구독 중(on)·미지원·iOS미설치면 숨김. 세션 내 닫으면 다시 안 뜸.
// ============================================
export function PushPromptCard({ desc }: { desc?: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PROMO_DISMISS_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      // 무시
    }
    detectStatus().then(setStatus);
  }, []);

  if (
    dismissed ||
    status === "loading" ||
    status === "on" ||
    status === "unsupported" ||
    status === "ios-not-installed"
  ) {
    return null;
  }

  function dismiss() {
    try {
      sessionStorage.setItem(PROMO_DISMISS_KEY, "1");
    } catch {
      // 무시
    }
    setDismissed(true);
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-amber-50 px-4 py-3">
        <span className="shrink-0 text-2xl" aria-hidden="true">
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">푸시 알림 받기</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {desc ?? "새 맞춤·마감 임박 소식을 폰으로 받아보세요."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-rose-500 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-rose-600"
        >
          켜기
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      {open && <PushSettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ============================================
// 설정 모달 — 마스터 토글 + 종류별 토글
// ============================================
function PushSettingsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(ALL_IDS);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setSelected(loadPref());
    detectStatus().then(setStatus);
  }, []);

  async function enable(categories: string[]) {
    setError(null);
    setStatus("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "permission-denied" : "ready");
        return;
      }
      savePref(categories);
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
          await subscribePushAction({
            ...p,
            userAgent:
              typeof navigator !== "undefined" ? navigator.userAgent : null,
          });
        }
      } catch {
        // 구독 단계 실패(VAPID 미설정·미로그인) — 권한·선호는 이미 저장됨.
      }
      setStatus("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("ready");
    }
  }

  async function disable() {
    setError(null);
    setStatus("working");
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          try {
            await unsubscribePushAction(sub.endpoint);
          } catch {
            // 서버 해지 실패 무시
          }
          await sub.unsubscribe();
        }
      }
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("on");
    }
  }

  function toggleMaster() {
    if (status === "on") disable();
    else enable(selected);
  }

  function toggleCategory(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      savePref(next);
      return next;
    });
  }

  if (!mounted) return null;

  const masterOn = status === "on";
  const masterDisabled =
    status === "loading" ||
    status === "working" ||
    status === "unsupported" ||
    status === "ios-not-installed" ||
    status === "permission-denied";
  const catDisabled =
    status === "loading" ||
    status === "unsupported" ||
    status === "ios-not-installed";

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1000] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="pb-safe fixed inset-x-3 bottom-3 z-[1001] max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2"
        role="dialog"
        aria-modal="true"
        aria-label="푸시 알림 설정"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
            <span aria-hidden="true">🔔</span> 푸시 알림 설정
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* 마스터 토글 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                이 기기에서 알림 받기
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {masterSubtext(status)}
              </p>
            </div>
            <Toggle on={masterOn} disabled={masterDisabled} onClick={toggleMaster} />
          </div>
        </div>

        {/* 종류별 토글 */}
        <p className="mb-1.5 mt-4 px-1 text-xs font-bold tracking-wide text-slate-400">
          받을 알림 종류
        </p>
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-3.5 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0 text-lg" aria-hidden="true">
                  {c.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800">
                    {c.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {c.desc}
                  </p>
                </div>
              </div>
              <Toggle
                on={selected.includes(c.id)}
                disabled={catDisabled}
                onClick={() => toggleCategory(c.id)}
              />
            </div>
          ))}
        </div>

        {status === "permission-denied" && (
          <div className="mt-3 rounded-xl bg-rose-50 px-3.5 py-3">
            <p className="text-xs font-bold text-rose-800">
              브라우저에서 알림이 차단돼 있어요
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-700">
              한 번 차단하면 앱에서 바로 못 켜요(브라우저 보안). 아래처럼 직접
              풀어주세요:
            </p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-rose-700">
              <li>
                주소창 왼쪽 <strong>자물쇠</strong>(또는 <strong>ⓘ</strong>) 탭
              </li>
              <li>
                <strong>알림</strong>(권한) → <strong>허용</strong>으로 변경
              </li>
              <li>
                아래 <strong>다시 확인</strong> 누르기
              </li>
            </ol>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStatus("loading");
                detectStatus().then(setStatus);
              }}
              className="mt-2.5 w-full rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-600"
            >
              다시 확인
            </button>
          </div>
        )}

        <p className="mt-3 px-1 text-[11px] leading-relaxed text-slate-400">
          푸시 알림은 순차 도입 중이에요. 지금 설정해두면 시작될 때 바로 적용돼요.
        </p>

        {error && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            {error}
          </p>
        )}
      </div>
    </>,
    document.body
  );
}

function masterSubtext(status: Status): string {
  switch (status) {
    case "on":
      return "켜져 있어요 · 마감·새 혜택을 폰으로 받아요";
    case "working":
      return "처리 중…";
    case "permission-denied":
      return "브라우저에서 차단됨";
    case "unsupported":
      return "이 브라우저는 푸시를 지원하지 않아요";
    case "ios-not-installed":
      return "홈 화면에 추가한 뒤 켤 수 있어요";
    case "loading":
      return "상태 확인 중…";
    default:
      return "꺼져 있어요 · 켜면 알림을 받아요";
  }
}

// ============================================
// 토글 스위치 (토스 스타일)
// ============================================
function Toggle({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
        on ? "bg-rose-500" : "bg-slate-300"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ============================================
// 선호(항목) 저장 — localStorage (서버 동기화는 발송 도입 시 후속)
// ============================================
function loadPref(): string[] {
  if (typeof window === "undefined") return ALL_IDS;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return ALL_IDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    return ALL_IDS;
  } catch {
    return ALL_IDS;
  }
}

function savePref(categories: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(categories));
  } catch {
    // 무시
  }
}

// ============================================
// 상태 감지 (PushToggle과 동일 로직)
// ============================================
async function detectStatus(): Promise<Status> {
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

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  return isIos && isSafari;
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

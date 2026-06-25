"use client";

// ============================================
// 푸시 알림 설정 — 더보기 시트에서 진입하는 모달.
// 전체 허용(추천) / 항목별 허용 분기. 클릭 시 브라우저 권한 요청 + (가능하면) 구독.
//
// 현재: 푸시 발송 인프라(VAPID·발송 cron)가 순차 도입 중 → 구독이 실패해도
//       권한·선호는 저장하고 "곧 시작" 안내. VAPID 켜지면 그대로 동작.
// 우선은 "전체 허용"으로 유도(항목별은 접어둠).
//
// ⚠️ 모달은 createPortal(body) — 시트 transform / 헤더 backdrop-blur의
//    containing block 회피 (InstallActions 패턴 동일).
// ============================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { subscribePushAction } from "../actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PREF_KEY = "umbba-radar:push-categories";
const PROMO_DISMISS_KEY = "umbba-radar:push-promo-dismissed";

const CATEGORIES = [
  { id: "deadline", label: "마감 임박", desc: "관심 카드 마감 1일 전" },
  { id: "new", label: "새 협찬·체험단", desc: "새 혜택이 올라오면" },
  { id: "my_child", label: "내 아이 맞춤", desc: "우리 아이 시기 혜택" },
  { id: "tips", label: "후기·꿀팁", desc: "엄빠 꿀정보 모음" },
] as const;

const ALL_IDS = CATEGORIES.map((c) => c.id);

type Status =
  | "loading"
  | "unsupported"
  | "ios-not-installed"
  | "permission-denied"
  | "ready"
  | "on"
  | "working";

// ============================================
// 진입 버튼 (더보기 시트 안)
// ============================================
export function PushSettingsEntry({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);

  function handle() {
    // 시트 닫힘 애니(300ms) 끝난 뒤 모달 (겹침 방지)
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

  // 켜짐·미지원·iOS미설치·로딩 → 권유 의미 없음 → 숨김
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
// 설정 모달
// ============================================
function PushSettingsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [byCategory, setByCategory] = useState(false);
  const [selected, setSelected] = useState<string[]>(ALL_IDS);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setSelected(loadPref());
    detectStatus().then(setStatus);
  }, []);

  async function allow(categories: string[]) {
    setError(null);
    setStatus("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "permission-denied" : "ready");
        return;
      }
      // 권한 OK → 선호 저장(즉시) + 구독 시도(실패해도 무시: VAPID/로그인 미비 가능)
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
        // 구독 단계 실패(VAPID 미설정·미로그인 등) — 권한·선호는 이미 저장됨.
        // 푸시 발송 시작 시 자동 연결되므로 사용자에겐 성공으로 안내.
      }
      setStatus("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("ready");
    }
  }

  function toggleCategory(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (!mounted) return null;

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
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 text-2xl">
            🔔
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold tracking-tight text-slate-900">
              푸시 알림 설정
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              새 협찬·마감 임박 소식을 폰으로 받아보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-4">
          {status === "loading" && (
            <p className="text-xs text-slate-400">상태 확인 중…</p>
          )}

          {status === "unsupported" && (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
              이 브라우저는 푸시 알림을 지원하지 않아요. Chrome·삼성 인터넷 등에서
              열어주세요.
            </p>
          )}

          {status === "ios-not-installed" && (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
              iPhone은 <strong>홈 화면에 추가</strong> 후 켤 수 있어요. (Safari →
              공유 → 홈 화면에 추가)
            </p>
          )}

          {status === "permission-denied" && (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700">
              알림이 차단돼 있어요. 브라우저 설정 → 사이트 알림에서{" "}
              <strong>umbba-radar.com</strong>을 허용해주세요.
            </p>
          )}

          {status === "on" && (
            <div className="rounded-xl bg-emerald-50 px-3 py-3 text-center">
              <p className="text-sm font-bold text-emerald-700">
                ✓ 알림을 받을게요!
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-600">
                푸시 알림은 순차 도입 중이라, 시작되면 이 설정대로 바로
                보내드려요.
              </p>
            </div>
          )}

          {(status === "ready" || status === "working") && (
            <div className="space-y-3">
              {/* 전체 허용 — 추천(기본 유도) */}
              <button
                type="button"
                disabled={status === "working"}
                onClick={() => allow(ALL_IDS)}
                className="flex w-full items-center justify-between rounded-2xl bg-rose-500 px-4 py-3.5 text-left text-white transition hover:bg-rose-600 active:scale-[0.99] disabled:opacity-60"
              >
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    전체 허용
                    <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-bold">
                      추천
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-rose-50">
                    새 혜택·마감 임박·맞춤 소식을 모두 받아요
                  </span>
                </span>
                <span aria-hidden="true" className="text-base">
                  →
                </span>
              </button>

              {/* 항목별 — 보조(접어둠) */}
              <button
                type="button"
                onClick={() => setByCategory((v) => !v)}
                className="flex w-full items-center justify-between px-1 text-xs font-medium text-slate-500"
              >
                <span>항목별로 직접 고르기</span>
                <span aria-hidden="true">{byCategory ? "▲" : "▼"}</span>
              </button>

              {byCategory && (
                <div className="space-y-1.5 rounded-xl border border-slate-100 p-2">
                  {CATEGORIES.map((c) => {
                    const on = selected.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                            on
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-slate-300 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="flex-1">
                          <span className="block text-[13px] font-semibold text-slate-800">
                            {c.label}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            {c.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={status === "working" || selected.length === 0}
                    onClick={() => allow(selected)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    선택 항목만 허용
                  </button>
                </div>
              )}

              <p className="px-1 text-[11px] leading-relaxed text-slate-400">
                푸시 알림은 순차 도입 중이에요. 지금 허용해두면 시작될 때 바로
                받아볼 수 있어요.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </>,
    document.body
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

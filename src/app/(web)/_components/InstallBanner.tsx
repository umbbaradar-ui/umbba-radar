"use client";

// ============================================
// PWA 설치 유도 배너
// - Android Chrome 계열: beforeinstallprompt 이벤트 사용 → "설치하기" 버튼
// - iOS Safari: 이벤트 없음 → "공유 → 홈 화면에 추가" 안내
// - 이미 PWA로 실행 중이거나 최근 닫았으면(7일) 노출 X
// - 페이지 진입 4초 후 노출 (콘텐츠 먼저 보이게)
// ============================================

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "umbba-install-dismissed-at";
const COOLDOWN_DAYS = 7;
const SHOW_DELAY_MS = 4000;

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const at = localStorage.getItem(STORAGE_KEY);
  if (!at) return false;
  const ts = parseInt(at, 10);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

type Variant = "chrome" | "ios" | null;

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [variant, setVariant] = useState<Variant>(null);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleShow = () => {
      if (timer) return;
      timer = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    };

    const onBefore = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVariant("chrome");
      scheduleShow();
    };
    window.addEventListener("beforeinstallprompt", onBefore);

    // iOS Safari는 beforeinstallprompt 미지원 → 즉시 ios variant로 안내
    if (isIOS()) {
      setVariant("ios");
      scheduleShow();
    }

    // 설치 완료 이벤트(android) — 배너 닫고 쿨다운 저장
    const onInstalled = () => {
      setShow(false);
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShow(false);
  };

  const handleInstall = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setShow(false);
      } else {
        dismiss();
      }
    } catch (err) {
      console.warn("[install] prompt failed:", err);
      dismiss();
    }
  };

  if (!show || !variant) return null;

  return (
    <div
      className="pb-safe fixed inset-x-3 bottom-[88px] z-40 md:inset-x-auto md:bottom-4 md:right-4 md:max-w-sm"
      role="dialog"
      aria-label="앱 설치 안내"
    >
      <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.15)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 text-2xl">
            📡
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold tracking-tight text-slate-900">
              엄빠레이더 앱으로 설치하기
            </p>
            {variant === "chrome" ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                홈 화면에 추가하면 매번 빠르게 확인할 수 있어요
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Safari 하단{" "}
                <span className="font-bold text-slate-900">공유 ⎋</span> 누르고{" "}
                <span className="font-bold text-slate-900">
                  &quot;홈 화면에 추가&quot;
                </span>
                를 선택해주세요
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {variant === "chrome" && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-600"
                >
                  설치하기
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              >
                나중에
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="닫기"
            className="text-slate-300 transition hover:text-slate-500"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

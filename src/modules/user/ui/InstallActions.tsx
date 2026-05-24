"use client";

// ============================================
// PWA 설치 진입점 — 더보기 시트 + GNB 두 곳에서 사용
// useInstallPrompt 훅 + 두 가지 변형(SheetEntry, NavChip)
//
// 동작:
// - 이미 PWA로 설치되어 있으면(standalone) 모든 진입점 숨김
// - Android/Desktop Chrome: beforeinstallprompt 이벤트로 네이티브 설치 다이얼로그 호출
// - iOS Safari: 이벤트 없으므로 "공유 → 홈 화면에 추가" 가이드 모달 표시
// - 미지원 환경(KakaoTalk in-app 등): 모든 진입점 숨김
// ============================================

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState =
  | { kind: "loading" }
  | { kind: "standalone" } // 이미 PWA로 실행 중
  | { kind: "available"; prompt: () => Promise<void> } // Android/Desktop Chrome
  | { kind: "ios" } // iOS Safari (가이드 모달)
  | { kind: "unsupported" }; // KakaoTalk in-app browser 등

function detectIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function useInstallPrompt(): InstallState {
  const [state, setState] = useState<InstallState>({ kind: "loading" });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (detectStandalone()) {
      setState({ kind: "standalone" });
      return;
    }

    if (detectIOS()) {
      setState({ kind: "ios" });
      return;
    }

    let installEvent: BeforeInstallPromptEvent | null = null;
    const onBefore = (e: Event) => {
      e.preventDefault();
      installEvent = e as BeforeInstallPromptEvent;
      setState({
        kind: "available",
        prompt: async () => {
          if (!installEvent) return;
          await installEvent.prompt();
          const choice = await installEvent.userChoice;
          if (choice.outcome === "accepted") {
            // appinstalled 이벤트가 곧 fire 됨
            setState({ kind: "standalone" });
          }
        },
      });
    };
    window.addEventListener("beforeinstallprompt", onBefore);

    const onInstalled = () => setState({ kind: "standalone" });
    window.addEventListener("appinstalled", onInstalled);

    // 2.5초 안에 beforeinstallprompt 안 오면 미지원 환경으로 판정
    const t = setTimeout(() => {
      if (!installEvent) setState({ kind: "unsupported" });
    }, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  return state;
}

// ============================================
// iOS 가이드 모달 (공유 버튼 → 홈 화면에 추가 안내)
// ============================================
function IOSGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="pb-safe fixed inset-x-3 bottom-3 z-[61] rounded-2xl bg-white p-5 shadow-2xl sm:left-1/2 sm:right-auto sm:bottom-1/2 sm:-translate-x-1/2 sm:translate-y-1/2 sm:max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 text-2xl">
            📲
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold tracking-tight text-slate-900">
              홈 화면에 추가하기
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Safari 하단의{" "}
              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">
                공유 ⎋
              </span>{" "}
              버튼을 눌러주세요.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              메뉴에서{" "}
              <span className="font-bold text-slate-900">
                &quot;홈 화면에 추가&quot;
              </span>
              를 선택하면 끝!
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              💡 홈 화면 아이콘으로 들어오면 일반 앱처럼 빠르고 깔끔하게 사용할 수 있어요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
        >
          확인
        </button>
      </div>
    </>
  );
}

// ============================================
// 더보기 시트 안에 들어가는 메뉴 항목 (full width row)
// ============================================
interface SheetEntryProps {
  onClick?: () => void;
}

export function InstallSheetEntry({ onClick }: SheetEntryProps) {
  const state = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  // 이미 설치됨 / 미지원 / 로딩 중 → 숨김
  if (state.kind === "standalone" || state.kind === "unsupported" || state.kind === "loading") {
    return null;
  }

  const handleClick = async () => {
    if (state.kind === "available") {
      onClick?.();
      try {
        await state.prompt();
      } catch (err) {
        console.warn("[install] prompt failed:", err);
      }
    } else if (state.kind === "ios") {
      setIosOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-rose-50 to-amber-50 px-3 py-3 text-left text-sm font-semibold text-rose-900 transition hover:from-rose-100 hover:to-amber-100"
      >
        <span aria-hidden="true" className="text-base">
          📲
        </span>
        <span className="flex-1">
          홈 화면에 추가하기
          <span className="ml-1.5 rounded-full bg-rose-200 px-1.5 py-0.5 text-[9px] font-bold text-rose-800">
            앱처럼
          </span>
        </span>
        <span aria-hidden="true" className="text-xs text-rose-600">
          →
        </span>
      </button>
      {iosOpen && <IOSGuideModal onClose={() => setIosOpen(false)} />}
    </>
  );
}

// ============================================
// GNB(상단 네비)용 작은 칩 — 데스크탑 + 모바일 헤더에 배치
// ============================================
interface NavChipProps {
  variant?: "desktop" | "mobile";
}

export function InstallNavChip({ variant = "desktop" }: NavChipProps) {
  const state = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  if (state.kind === "standalone" || state.kind === "unsupported" || state.kind === "loading") {
    return null;
  }

  const handleClick = async () => {
    if (state.kind === "available") {
      try {
        await state.prompt();
      } catch (err) {
        console.warn("[install] prompt failed:", err);
      }
    } else if (state.kind === "ios") {
      setIosOpen(true);
    }
  };

  if (variant === "mobile") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          aria-label="홈 화면에 추가"
          className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 transition active:scale-95"
        >
          <span aria-hidden="true">📲</span>
          <span>앱 설치</span>
        </button>
        {iosOpen && <IOSGuideModal onClose={() => setIosOpen(false)} />}
      </>
    );
  }

  // desktop
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-100 to-amber-100 px-3 py-1.5 text-sm font-bold text-rose-700 transition hover:from-rose-200 hover:to-amber-200"
      >
        <span aria-hidden="true">📲</span>
        <span>앱 설치하기</span>
      </button>
      {iosOpen && <IOSGuideModal onClose={() => setIosOpen(false)} />}
    </>
  );
}

"use client";

// ============================================
// PWA 설치 진입점 — 더보기 시트 + GNB 두 곳에서 사용
//
// 동작 원칙:
// - 이미 설치(standalone)면 모든 진입점 숨김
// - 아니면 항상 노출 (브라우저가 PWA 지원하든 안 하든, 사용자한테 결정권을 줌)
// - 클릭 시 최선책 시도: 네이티브 prompt → iOS 가이드 → 일반 브라우저 메뉴 안내
//
// 이전 버전의 2.5초 timeout 로직 제거:
//   Chrome은 'beforeinstallprompt'를 참여도 휴리스틱(엔게이지먼트) 후에 쏘는 경우가 많아
//   첫 방문에서 이벤트를 못 받는 일이 흔함. 그래서 타임아웃으로 숨기면 평생 못 봄.
// ============================================

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "loading" | "installed" | "visible";

function detectIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ 는 데스크탑 UA 보내지만 터치 디바이스 → 보조 판별
  if (/Mac/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return true;
  return false;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function useInstall() {
  const [state, setState] = useState<InstallState>("loading");
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (detectStandalone()) {
      setState("installed");
      return;
    }

    // 설치 안 됐으면 일단 노출 시작 (이벤트 기다림 X)
    setState("visible");

    const onBefore = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onBefore);

    const onInstalled = () => {
      promptRef.current = null;
      setState("installed");
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return { state, promptRef };
}

// ============================================
// 모달 1: iOS Safari 가이드
// ============================================
function IOSGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="pb-safe fixed inset-x-3 bottom-3 z-[61] rounded-2xl bg-white p-5 shadow-2xl sm:left-1/2 sm:right-auto sm:bottom-1/2 sm:-translate-x-1/2 sm:translate-y-1/2 sm:max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 text-2xl">
            📲
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold tracking-tight text-slate-900">
              iOS Safari에서 홈 화면에 추가
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
              <span className="font-bold text-slate-900">&quot;홈 화면에 추가&quot;</span>를
              선택하면 끝!
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              💡 일반 앱처럼 홈 화면 아이콘에서 바로 들어올 수 있어요.
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
// 모달 2: Android/Desktop 일반 가이드 (네이티브 prompt 이벤트 못 받은 경우)
// ============================================
function ManualGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="pb-safe fixed inset-x-3 bottom-3 z-[61] rounded-2xl bg-white p-5 shadow-2xl sm:left-1/2 sm:right-auto sm:bottom-1/2 sm:-translate-x-1/2 sm:translate-y-1/2 sm:max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 text-2xl">
            📲
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold tracking-tight text-slate-900">
              앱처럼 홈 화면에 추가
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              브라우저 우측 상단{" "}
              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">
                ⋮ 메뉴
              </span>{" "}
              를 눌러주세요.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              <span className="font-bold text-slate-900">
                &quot;앱 설치&quot;
              </span>{" "}
              또는{" "}
              <span className="font-bold text-slate-900">
                &quot;홈 화면에 추가&quot;
              </span>{" "}
              항목 선택.
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              💡 Chrome·Samsung Internet·Edge 등에서 같은 메뉴를 찾을 수 있어요. 일부 브라우저(Firefox 모바일)는 지원 안 함.
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
// 공통 클릭 핸들러 hook
// ============================================
function useInstallHandler() {
  const { state, promptRef } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const handleClick = async () => {
    // 1. 네이티브 prompt 가능하면 우선 시도 (Android Chrome 정상 케이스)
    if (promptRef.current) {
      try {
        await promptRef.current.prompt();
        return;
      } catch (err) {
        console.warn("[install] prompt failed:", err);
      }
    }
    // 2. iOS면 iOS 가이드
    if (detectIOS()) {
      setIosOpen(true);
      return;
    }
    // 3. 그 외 (Android Chrome 이벤트 못 받음 + Firefox 등)
    setManualOpen(true);
  };

  return {
    state,
    handleClick,
    modal: (
      <>
        {iosOpen && <IOSGuideModal onClose={() => setIosOpen(false)} />}
        {manualOpen && <ManualGuideModal onClose={() => setManualOpen(false)} />}
      </>
    ),
  };
}

// ============================================
// 더보기 시트 안에 들어가는 메뉴 항목
// ============================================
interface SheetEntryProps {
  onClick?: () => void;
}

export function InstallSheetEntry({ onClick }: SheetEntryProps) {
  const { state, handleClick, modal } = useInstallHandler();

  if (state === "installed" || state === "loading") return null;

  const onPress = () => {
    onClick?.();
    handleClick();
  };

  return (
    <>
      <button
        type="button"
        onClick={onPress}
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
      {modal}
    </>
  );
}

// ============================================
// GNB용 작은 칩 (데스크탑·모바일 variant)
// ============================================
interface NavChipProps {
  variant?: "desktop" | "mobile";
}

export function InstallNavChip({ variant = "desktop" }: NavChipProps) {
  const { state, handleClick, modal } = useInstallHandler();

  if (state === "installed" || state === "loading") return null;

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
        {modal}
      </>
    );
  }

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
      {modal}
    </>
  );
}

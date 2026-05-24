"use client";

// ============================================
// 첫 진입 스플래시 — 웹·PWA 모두 노출
// Android OS 스플래시는 아이콘만 띄우고 텍스트 없음 → 직후 이 컴포넌트로 슬로건 보강
// sessionStorage 로 같은 세션엔 한 번만 표시 (탭 이동마다 깜빡임 방지)
// PWA(standalone)에선 노출 시간을 조금 더 길게 잡아 OS 스플래시 → 자연스럽게 연결
// ============================================

import { useEffect, useState } from "react";

const STORAGE_KEY = "umbba-splash-shown";
const HOLD_MS_WEB = 900;
const HOLD_MS_PWA = 1200;
const FADE_MS = 350;

function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  // Android·Desktop Chrome 등 표준
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari (홈화면 추가)
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return false;
}

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "in" | "out" | "done">(
    "hidden"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 같은 세션에 이미 봤으면 건너뜀 (브라우저 탭 내비게이션 깜빡임 방지)
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setPhase("done");
      return;
    }

    const holdMs = isStandalonePWA() ? HOLD_MS_PWA : HOLD_MS_WEB;

    // 1프레임 뒤 페이드 인 (마운트 직후 transition 작동)
    requestAnimationFrame(() => setPhase("in"));
    const holdTimer = setTimeout(() => setPhase("out"), holdMs);
    return () => clearTimeout(holdTimer);
  }, []);

  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done" || phase === "hidden") return null;

  return (
    <div
      className={`pt-safe pb-safe fixed inset-0 z-[100] flex flex-col items-center bg-gradient-to-br from-pink-50 via-pink-50 to-rose-100 transition-opacity ${
        phase === "in" ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      {/* 마스코트 + 제목 → 화면 중앙 (flex-1 + justify-center로 수직 중앙) */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bear-mascot.png"
          alt=""
          width={140}
          height={140}
          className="rounded-[28px] drop-shadow-md"
        />
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          엄빠레이더
        </h1>
      </div>

      {/* 슬로건 → 하단 (safe-area 위로 살짝 띄움) */}
      <p className="mb-12 text-sm font-medium text-rose-700">
        엄빠 대신 매일 혜택 스캔 중 ♥
      </p>
    </div>
  );
}

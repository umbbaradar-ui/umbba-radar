"use client";

// ============================================
// 첫 진입 스플래시 — 웹 브라우저 전용
// PWA(standalone)는 OS 자체 스플래시가 이미 있으므로 skip
// sessionStorage 로 같은 세션엔 한 번만 표시
// ============================================

import { useEffect, useState } from "react";

const STORAGE_KEY = "umbba-splash-shown";
const HOLD_MS = 900;
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

    // PWA로 설치된 경우 OS 스플래시와 중복되므로 skip
    if (isStandalonePWA()) {
      setPhase("done");
      return;
    }

    // 같은 세션에 이미 봤으면 건너뜀
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setPhase("done");
      return;
    }

    // 1프레임 뒤 페이드 인 (마운트 직후 transition 작동)
    requestAnimationFrame(() => setPhase("in"));
    const holdTimer = setTimeout(() => setPhase("out"), HOLD_MS);
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
      className={`pt-safe pb-safe fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-pink-50 via-pink-50 to-rose-100 transition-opacity ${
        phase === "in" ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      {/* 마스코트 (public/bear-mascot.png 참조) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bear-mascot.png"
        alt=""
        width={140}
        height={140}
        className="rounded-[28px] drop-shadow-md"
      />
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          엄빠레이더
        </h1>
        <p className="mt-2.5 text-sm font-medium text-rose-700">
          엄빠 대신 매일 혜택 스캔 중 ♥
        </p>
      </div>
    </div>
  );
}

"use client";

// ============================================
// 첫 진입 스플래시 — 브랜드 + 슬로건을 1.5초간 강조
// sessionStorage 로 같은 세션엔 한 번만 표시
// ============================================

import { useEffect, useState } from "react";
import { Logo } from "@/shared/ui/Logo";

const STORAGE_KEY = "umbba-splash-shown";
const HOLD_MS = 1400;

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "in" | "out" | "done">(
    "hidden"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    }, 400);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done" || phase === "hidden") return null;

  return (
    <div
      className={`pt-safe pb-safe fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-amber-50 via-amber-50 to-rose-50 transition-opacity duration-400 ${
        phase === "in" ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <Logo size={84} className="text-rose-500 drop-shadow-sm" />
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          엄빠레이더
        </h1>
        <p className="mt-2.5 text-sm font-medium text-slate-600">
          자녀 키우면서 놓치는 혜택 없게!
        </p>
      </div>
    </div>
  );
}

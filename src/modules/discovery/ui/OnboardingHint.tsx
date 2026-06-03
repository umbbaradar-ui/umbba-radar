"use client";

// ============================================
// OnboardingHint — 자녀 시기 미등록 사용자에게 "맞춤 추천" 가치를 알리는 안내 배너
// 첫인상 강화: 신규 방문자에게 "뭐 하는 앱 + 자녀 등록하면 내 아이 맞춤"을 1초에 전달.
// hasChildren=false 일 때만 노출(비로그인 + 로그인했지만 자녀 미등록 둘 다 커버).
// 닫으면 세션 동안 다시 안 뜸(sessionStorage).
// ============================================

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "umbba-onboarding-hint-dismissed";

export function OnboardingHint() {
  // SSR/CSR 깜빡임 방지: 마운트 후에만 노출 결정
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // sessionStorage 불가 환경 — 그냥 노출
    }
    setShow(true);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 무시
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-amber-50 px-4 py-3.5">
      <span className="text-2xl" aria-hidden="true">
        🐻
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">
          내 아이 시기에 딱 맞는 혜택만 받아보세요
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          자녀 생년월일만 등록하면 임신·신생아·영아·유아·초등 맞춤 카드를 골라드려요.
        </p>
      </div>
      <Link
        href="/signup"
        className="shrink-0 rounded-full bg-rose-500 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-rose-600"
      >
        시작하기
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="안내 닫기"
        className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}

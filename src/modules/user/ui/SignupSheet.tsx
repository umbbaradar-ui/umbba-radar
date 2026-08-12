"use client";

// ============================================
// SignupSheet — 가입 유도 공용 바텀시트 (원탭 소셜 로그인 내장)
//
// 2026-07 게이트 개편: 가입 유도 지점(ViewGate·탐색 더보기)에서
// /signup 페이지로 리다이렉트하지 않고, 그 자리에서 카카오·구글
// 원탭으로 바로 가입 → OAuth 콜백 next로 보던 화면 복귀.
// 마찰(페이지 이동 2회)을 시트 1회로 줄이는 것이 목적.
//
// 계측: 마운트 시 lock_impression, 버튼 탭 시 lock_click
// (surface별 가입 전환율 측정 — 30일 데이터 기준 게이트 도달 3명뿐이라
//  개편 효과를 반드시 수치로 관찰할 것)
// ============================================

import { useEffect } from "react";
import Link from "next/link";
import {
  KakaoSignInButton,
  GoogleSignInButton,
} from "@/modules/user/ui/SignInButton";
import { track } from "@/modules/analytics/service";

interface Props {
  /** 가입·로그인 후 돌아올 경로 (보던 화면 복귀) */
  next: string;
  /** 계측용 지점 식별자 (view_gate | explore_more | ...) */
  surface: string;
  headline: string;
  sub: React.ReactNode;
  /** 닫기(이탈) 버튼 — 없으면 닫기 불가(하드 게이트) */
  onClose?: () => void;
  closeLabel?: string;
}

const kakaoEnabled = process.env.NEXT_PUBLIC_KAKAO_OAUTH_ENABLED === "true";
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";

export function SignupSheet({
  next,
  surface,
  headline,
  sub,
  onClose,
  closeLabel = "나중에 할게요",
}: Props) {
  // 노출 계측 + 배경 스크롤 잠금
  useEffect(() => {
    track("lock_impression", { surface });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [surface]);

  const markClick = (target: string) => () =>
    track("lock_click", { surface, target });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="가입 안내"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] text-center shadow-xl sm:rounded-3xl sm:pb-6">
        <div aria-hidden className="text-4xl">
          🐻
        </div>
        <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900">
          {headline}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{sub}</p>

        <div className="mt-5 space-y-2">
          {kakaoEnabled && (
            <div onClickCapture={markClick("kakao")}>
              <KakaoSignInButton next={next} />
            </div>
          )}
          {googleEnabled && (
            <div onClickCapture={markClick("google")}>
              <GoogleSignInButton next={next} />
            </div>
          )}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            onClick={markClick("email")}
            className="block w-full rounded-xl px-4 py-2.5 text-xs font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            이메일로 가입할래요
          </Link>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={() => {
              track("lock_dismiss", { surface });
              onClose();
            }}
            className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
          >
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  );
}

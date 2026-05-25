"use client";

// ============================================
// 알림 페이지 sticky 헤더 — 뒤로가기 + 타이틀
//
// 동작:
//   - 스크롤해도 viewport 상단에 고정 (sticky top-0)
//   - 모바일 상단 헤더보다 z-index 높게 (z-30 > z-20) → 알림 페이지 안에선 가림
//   - 뒤로가기: history.back() with fallback to "/" (외부 직접 진입 케이스)
// ============================================

import { useRouter } from "next/navigation";

interface Props {
  /** 부제목 (예: "12건" 또는 "내 아이에 맞는 혜택을 모아드려요") */
  subtitle: string;
}

export function NotificationsHeader({ subtitle }: Props) {
  const router = useRouter();

  const handleBack = () => {
    // 외부에서 직접 URL 진입한 경우 history.back()은 사이트 외부로 나감
    // → 히스토리 길이 > 1이면 back, 아니면 홈으로
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="pt-safe sticky top-0 z-30 border-b border-amber-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로가기"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-95"
        >
          <BackIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-extrabold tracking-tight text-slate-900">
            알림
          </h1>
          <p className="truncate text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

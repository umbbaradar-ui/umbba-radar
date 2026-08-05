"use client";

// ============================================
// BackToListLink — 상세 페이지 "← 목록으로"
//
// 기존 href="/" 하드코딩은 탐색(/explore)에서 상세를 열고 돌아갈 때
// 필터·스크롤을 전부 버리고 홈 첫 화면으로 튕기는 원인이었다(테스터 피드백 1·3).
// → 앱 안에서 목록(홈/탐색)을 거쳐 온 경우 router.back()으로 이전 화면 복귀
//   (URL 필터 + ExploreView의 세션 스크롤 복원과 맞물려 보던 위치 그대로).
// → 공유 링크 등으로 상세에 직접 진입한 경우엔 홈으로 폴백.
//
// "목록을 거쳐 왔는지"는 HomeView/ExploreView가 마운트 시 심는
// sessionStorage 플래그(umbba:visited-list, 탭 단위)로 판별 —
// document.referrer는 SPA 내비게이션에서 신뢰할 수 없어서 쓰지 않는다.
// ============================================

import { useRouter } from "next/navigation";

export const VISITED_LIST_KEY = "umbba:visited-list";

export function BackToListLink() {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    let visited = false;
    try {
      visited = sessionStorage.getItem(VISITED_LIST_KEY) === "1";
    } catch {
      // sessionStorage 접근 불가(시크릿 모드 등) → 홈 폴백
    }
    if (visited && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <a
      href="/"
      onClick={handleClick}
      className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900"
    >
      ← 목록으로
    </a>
  );
}

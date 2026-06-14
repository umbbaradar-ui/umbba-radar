"use client";

// ============================================
// 카드 공유 버튼 — 역할별 카피 (바이럴 핵심 장치)
// 엄마(로그인) → "남편한테 보내기 💌" / 아빠(로그인) → "아내한테 보내기 💌"
// 기타·비로그인 → "공유하기 💌" (성별 가정 안 함, 따뜻한 중립)
// Web Share API(모바일 네이티브 공유시트) 우선, 미지원(데스크탑 등)이면 링크 복사 fallback.
//
// 정책: 앱 내 신청 처리 X — "발견·공유"만. 공유 대상은 카드 상세 퍼머링크.
// 분석: card_share 이벤트 기록 (ANALYTICS)
// ============================================

import { useState } from "react";
import { track } from "@/modules/analytics/service";

// 서버(service-server)의 ParentRole과 동일한 값. "use client"라 server-only 모듈에서 import 못 해 로컬 선언.
type ShareRole = "mother" | "father" | "other";

interface Props {
  postId: string;
  title: string;
  brandName?: string | null;
  /** 로그인 사용자의 부모 역할. 없으면(비로그인·기타) 중립 카피 */
  role?: ShareRole | null;
}

// 역할별 버튼 라벨 — "부부" 브랜드 훅은 로그인 엄마/아빠에게만, 미상은 중립
function shareLabel(role?: ShareRole | null): string {
  if (role === "mother") return "남편한테 보내기 💌";
  if (role === "father") return "아내한테 보내기 💌";
  return "공유하기 💌";
}

export function ShareButton({ postId, title, brandName, role }: Props) {
  const [copied, setCopied] = useState(false);

  // 절대 URL — 공유받은 사람이 바로 열 수 있게. window 기준(현재 origin)
  function buildShareUrl(): string {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/post/${postId}`;
    }
    return `https://umbba-radar.com/post/${postId}`;
  }

  async function handleShare() {
    const url = buildShareUrl();
    const shareTitle = brandName ? `[${brandName}] ${title}` : title;
    const shareText = `${shareTitle}\n엄빠레이더에서 찾은 혜택이에요 🐻`;

    // 1) Web Share API (모바일) — 네이티브 공유시트(카톡·문자 등)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url });
        track("card_share", { post_id: postId, method: "web_share" });
        return;
      } catch (e) {
        // 사용자가 공유시트를 그냥 닫음(AbortError) → 조용히 무시, fallback 안 함
        if (e instanceof DOMException && e.name === "AbortError") return;
        // 그 외 오류 → 링크 복사 fallback으로
      }
    }

    // 2) 링크 복사 fallback (데스크탑·미지원 브라우저)
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("card_share", { post_id: postId, method: "copy" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard도 막힌 환경 — 최후의 수단: prompt로 직접 복사
      window.prompt("아래 링크를 복사해서 공유하세요", url);
      track("card_share", { post_id: postId, method: "prompt" });
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.99]"
    >
      {copied ? (
        <>✓ 링크 복사됐어요!</>
      ) : (
        <>
          <ShareIcon />
          {shareLabel(role)}
        </>
      )}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

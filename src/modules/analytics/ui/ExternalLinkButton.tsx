"use client";

// ============================================
// 원문 외부 링크 버튼 — 클릭 시 source_link_click 이벤트 기록
// 결정적 KPI (원문 클릭률) 측정의 핵심 지점
// ============================================

import { track } from "../service";

interface Props {
  postId: string;
  sourceUrl: string;
  children: React.ReactNode;
  className?: string;
}

export function ExternalLinkButton({
  postId,
  sourceUrl,
  children,
  className,
}: Props) {
  function handleClick() {
    track("source_link_click", {
      post_id: postId,
      source_url: sourceUrl,
    });
  }

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}

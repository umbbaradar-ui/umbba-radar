"use client";

// ============================================
// 카드 상세 페이지 마운트 시 card_click 이벤트 기록
// PostCard를 클라이언트 컴포넌트로 만들지 않고 트래킹하는 트릭
// ============================================

import { useEffect } from "react";
import { track } from "../service";

export function CardClickTracker({ postId }: { postId: string }) {
  useEffect(() => {
    track("card_click", { post_id: postId });
  }, [postId]);

  return null;
}

"use client";

// ============================================
// ViewGate — 비로그인 사용자가 한 세션에 카드 상세를 N건 이상 열면
// 가입 페이지로 리다이렉트 (soft paywall)
// 로그인 사용자는 무제한
// ============================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "umbba-detail-views";
const FREE_VIEW_LIMIT = 4; // 4건은 자유 열람, 5번째부터 가입 유도

interface Props {
  postId: string;
  loggedIn: boolean;
}

export function ViewGate({ postId, loggedIn }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (loggedIn) return;
    if (typeof window === "undefined") return;

    let viewed: string[] = [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) viewed = parsed.filter((x) => typeof x === "string");
      }
    } catch {
      viewed = [];
    }

    // 이미 본 카드면 통과
    if (viewed.includes(postId)) return;

    // 무료 한도 이상이면 게이트
    if (viewed.length >= FREE_VIEW_LIMIT) {
      router.replace(
        `/signup?next=${encodeURIComponent(`/post/${postId}`)}&reason=more`
      );
      return;
    }

    // 첫 열람 — 기록
    viewed.push(postId);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(viewed));
  }, [postId, loggedIn, router]);

  return null;
}

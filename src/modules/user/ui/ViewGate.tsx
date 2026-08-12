"use client";

// ============================================
// ViewGate — 비로그인 사용자가 한 세션에 카드 상세를 N건 이상 열면
// 가입 유도 (soft paywall). 로그인 사용자는 무제한.
//
// 2026-07 게이트 개편 (30일 데이터 근거):
// - 무료 한도 4 → 2장: 비로그인 73%가 1장만 보고 이탈, 5장째 게이트는
//   30일간 3명에게만 발동 → 2장 이상 열람자(21명)로 도달 범위 7배 확대.
// - 시트 안에서 카카오·구글 원탭 가입(SignupSheet) — /signup 리다이렉트 제거,
//   가입 후 보던 카드로 복귀(next).
// ============================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignupSheet } from "@/modules/user/ui/SignupSheet";

const STORAGE_KEY = "umbba-detail-views";
const FREE_VIEW_LIMIT = 2; // 2건은 자유 열람, 3번째부터 가입 유도

interface Props {
  postId: string;
  loggedIn: boolean;
}

export function ViewGate({ postId, loggedIn }: Props) {
  const router = useRouter();
  const [gated, setGated] = useState(false);

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

    // 무료 한도 이상이면 게이트(오버레이)
    if (viewed.length >= FREE_VIEW_LIMIT) {
      setGated(true);
      return;
    }

    // 첫 열람 — 기록
    viewed.push(postId);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(viewed));
  }, [postId, loggedIn]);

  if (!gated) return null;

  return (
    <SignupSheet
      surface="view_gate"
      next={`/post/${postId}`}
      headline="더 보고 싶으시면"
      sub={
        <>
          오늘 무료 열람 {FREE_VIEW_LIMIT}장을 다 봤어요.
          <br />
          가입하면 끝까지 자유롭게, 우리 아이 시기 맞춤으로 챙겨드려요 ♥
        </>
      }
      onClose={() => {
        // 목록으로 복귀 — 히스토리가 있으면 보던 목록(필터·스크롤 보존)으로
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
      closeLabel="← 목록으로"
    />
  );
}

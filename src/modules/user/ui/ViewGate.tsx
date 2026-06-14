"use client";

// ============================================
// ViewGate — 비로그인 사용자가 한 세션에 카드 상세를 N건 이상 열면
// 가입 유도 (soft paywall). 로그인 사용자는 무제한.
//
// 개선: 기존엔 SSR 본문이 그려진 뒤 router.replace로 튕겨 "본문 깜빡임"이 있었음.
//       이제 한도 초과 시 router 이동 대신 인페이지 바텀시트(블러 오버레이)를 즉시 띄움.
//       → 깜빡임 없이 부드럽게, 모바일에서 하단 시트로 한 손 조작.
// ============================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "umbba-detail-views";
const FREE_VIEW_LIMIT = 4; // 4건은 자유 열람, 5번째부터 가입 유도

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
      // 스크롤 잠금
      document.body.style.overflow = "hidden";
      return;
    }

    // 첫 열람 — 기록
    viewed.push(postId);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(viewed));
  }, [postId, loggedIn]);

  // 언마운트 시 스크롤 복구
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!gated) return null;

  const signupHref = `/signup?next=${encodeURIComponent(`/post/${postId}`)}&reason=more`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="가입 안내"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 text-center shadow-xl sm:rounded-3xl sm:pb-6">
        <div aria-hidden className="text-4xl">🐻</div>
        <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900">
          더 보고 싶으시면
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          간단한 가입 한 번이면
          <br />
          자녀 시기 맞춤으로 끝까지 챙겨드려요 ♥
        </p>
        <button
          type="button"
          onClick={() => router.push(signupHref)}
          className="mt-5 w-full rounded-xl bg-rose-500 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-rose-600 active:scale-[0.99]"
        >
          가입하고 계속 보기
        </button>
        <button
          type="button"
          onClick={() => {
            document.body.style.overflow = "";
            router.push("/");
          }}
          className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
        >
          ← 목록으로
        </button>
      </div>
    </div>
  );
}

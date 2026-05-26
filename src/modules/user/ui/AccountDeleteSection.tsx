"use client";

// ============================================
// 회원 탈퇴 섹션 — /me 페이지 하단 위험 zone
// 2단 확인 모달(window.confirm) 후 Server Action 호출.
// 성공 시 홈으로 풀 리로드 (세션 정리·UI 갱신 안전).
// "탈퇴"는 사용자 친화 표현, 내부 동작은 계정+데이터 영구 삭제.
// ============================================

import { useState, useTransition } from "react";
import { deleteAccountAction } from "../actions";

export function AccountDeleteSection() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    const first = window.confirm(
      "탈퇴하면 계정과 모든 데이터(자녀 정보·관심 카드·푸시 구독 등)가\n" +
        "영구 삭제됩니다. 이 작업은 복구할 수 없어요.\n\n" +
        "정말 탈퇴하시겠어요?"
    );
    if (!first) return;
    const second = window.confirm("마지막 확인 — 정말 진행할까요?");
    if (!second) return;

    startTransition(async () => {
      const res = await deleteAccountAction();
      if (res.ok) {
        // 풀 리로드 — 모든 클라이언트 상태·SW·캐시 정리
        window.location.href = "/";
        return;
      }
      setError(res.error);
    });
  }

  return (
    <section className="mt-8 rounded-2xl border border-rose-100 bg-rose-50/30 p-5">
      <h2 className="text-sm font-bold text-rose-700">⚠️ 회원 탈퇴</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-rose-600">
        탈퇴하면 계정과 모든 데이터(자녀 정보·관심·신청 기록·푸시 구독 등)가
        영구 삭제돼요. 복구는 불가능합니다. 다시 가입은 가능하지만 이전 데이터는
        돌아오지 않아요.
      </p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="mt-3 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-60"
      >
        {pending ? "탈퇴 처리 중…" : "탈퇴하기"}
      </button>
      {error && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] text-rose-700">
          탈퇴 실패: {error}
        </p>
      )}
      <p className="mt-3 text-[10px] text-rose-500">
        문의: umbba.radar@gmail.com · 자세한 안내{" "}
        <a href="/account-deletion" className="underline">
          /account-deletion
        </a>
      </p>
    </section>
  );
}

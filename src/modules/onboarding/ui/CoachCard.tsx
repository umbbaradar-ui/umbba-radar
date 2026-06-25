"use client";

// ============================================
// CoachCard — 코치마크 말풍선(presentational). 위치 지정은 SpotlightTour가 담당.
// ============================================

import type { TutorialStep } from "../config/steps";

interface Props {
  step: TutorialStep;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function CoachCard({ step, index, total, onPrev, onNext, onSkip }: Props) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      {/* 진행 점 인디케이터 */}
      <div className="mb-2.5 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={
              i === index
                ? "h-1.5 w-4 rounded-full bg-rose-500"
                : i < index
                  ? "h-1.5 w-1.5 rounded-full bg-rose-200"
                  : "h-1.5 w-1.5 rounded-full bg-slate-200"
            }
          />
        ))}
      </div>

      <p className="text-base font-bold leading-snug text-slate-900">
        {step.title}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
        {step.body}
      </p>

      <div className="mt-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
        >
          건너뛰기
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={onPrev}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              이전
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-600 active:scale-95"
          >
            {isLast ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}

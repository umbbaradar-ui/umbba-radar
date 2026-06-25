"use client";

// ============================================
// SpotlightTour — 반투명 딤 + 영역 하이라이트(구멍) + 코치카드 코치마크.
// 라이브러리 0. createPortal(body)로 부모 stacking-context 함정 회피
// (InstallActions 패턴). SVG mask로 대상만 구멍 뚫어 강조.
// 대상 못 찾으면(rect=null) 가운데 카드 폴백 → 절대 멈추지 않음.
// ============================================

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { TutorialStep } from "../config/steps";
import { useTargetRect, type TargetRect } from "../hooks/useTargetRect";
import { CoachCard } from "./CoachCard";

interface Props {
  steps: TutorialStep[];
  onFinish: () => void;
}

const PAD = 8;
const RADIUS = 14;
const MASK_ID = "umbba-tutorial-spotlight";
/** 코치카드 대략 높이(반대편 배치 판단용) */
const CARD_EST = 180;

export function SpotlightTour({ steps, onFinish }: Props) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);

  const step = steps[index];
  const rect = useTargetRect(step?.selector ?? null);

  useEffect(() => setMounted(true), []);

  // 배경 스크롤 잠금 (ViewGate 패턴)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC = 건너뛰기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  if (!mounted || !step) return null;

  function next() {
    if (index >= steps.length - 1) onFinish();
    else setIndex((i) => i + 1);
  }
  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  const cardStyle = computeCardStyle(rect, step.placement);

  return createPortal(
    <div
      className="fixed inset-0 z-[1100]"
      role="dialog"
      aria-modal="true"
      aria-label="앱 사용법 안내"
    >
      {/* 반투명 딤 + 대상 구멍 (SVG mask) */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id={MASK_ID}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx={RADIUS}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="black"
          fillOpacity={0.62}
          mask={`url(#${MASK_ID})`}
        />
      </svg>

      {/* 강조 링 */}
      {rect && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[14px] ring-2 ring-rose-400"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      )}

      {/* 코치카드 */}
      <div className="pb-safe absolute" style={cardStyle}>
        <CoachCard
          step={step}
          index={index}
          total={steps.length}
          onPrev={prev}
          onNext={next}
          onSkip={onFinish}
        />
      </div>
    </div>,
    document.body
  );
}

/** 대상 위/아래 중 공간 있는 쪽에 카드 배치. 대상 없으면 가운데. */
function computeCardStyle(
  rect: TargetRect | null,
  placement: "above" | "below"
): CSSProperties {
  if (!rect) {
    return { left: 16, right: 16, top: Math.round(window.innerHeight * 0.4) };
  }
  const bottomRoom = window.innerHeight - (rect.top + rect.height);
  const topRoom = rect.top;

  let below = placement === "below";
  if (below && bottomRoom < CARD_EST && topRoom > CARD_EST) below = false;
  if (!below && topRoom < CARD_EST && bottomRoom >= CARD_EST) below = true;

  if (below) {
    return { left: 16, right: 16, top: Math.round(rect.top + rect.height + PAD + 6) };
  }
  return {
    left: 16,
    right: 16,
    bottom: Math.round(window.innerHeight - rect.top + PAD + 6),
  };
}

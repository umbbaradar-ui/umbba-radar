"use client";

// ============================================
// useTargetRect — 셀렉터로 대상 요소를 찾아 위치를 측정.
// - 같은 셀렉터가 여러 개면(예: dev의 숨은 main 복제, 카드 다수) "보이는(크기>0)
//   첫 요소"를 고름 → 숨김/0크기 매치 회피
// - 늦게 마운트될 수 있어 몇 번 재시도
// - resize·orientationchange·scroll 시 재측정(스크롤은 위치만 갱신, 재스크롤 X)
// - 끝내 못 찾으면 null → 호출부에서 가운데 폴백
// ============================================

import { useEffect, useState } from "react";

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MAX_TRIES = 12;
const RETRY_MS = 120;

export function useTargetRect(selector: string | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    let retryTimer = 0;
    let tries = 0;
    let cancelled = false;

    /** 매치 중 실제로 렌더된(크기>0) 첫 요소. 없으면 null */
    function findVisible(): Element | null {
      const all = document.querySelectorAll(selector!);
      for (const node of all) {
        const r = node.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) return node;
      }
      return null;
    }

    function toRect(el: Element): TargetRect {
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }

    function measure(allowScroll: boolean) {
      if (cancelled) return;
      const el = findVisible();
      if (!el) {
        // 아직 안 보임(늦은 마운트/숨김) → 재시도, 소진되면 폴백(null)
        if (tries++ < MAX_TRIES) {
          retryTimer = window.setTimeout(() => measure(allowScroll), RETRY_MS);
        } else {
          setRect(null);
        }
        return;
      }
      // 화면 밖이면 한 번만 중앙으로 스크롤(최초 측정 때만)
      if (allowScroll) {
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ block: "center" });
        }
      }
      setRect(toRect(el));
    }

    measure(true);

    const onReflow = () => {
      const el = findVisible();
      setRect(el ? toRect(el) : null);
    };
    window.addEventListener("resize", onReflow);
    window.addEventListener("orientationchange", onReflow);
    window.addEventListener("scroll", onReflow, true);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("orientationchange", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [selector]);

  return rect;
}

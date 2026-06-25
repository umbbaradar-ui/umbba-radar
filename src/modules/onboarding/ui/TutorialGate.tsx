"use client";

// ============================================
// TutorialGate — 튜토리얼을 띄울지 판정하고 SpotlightTour를 마운트.
// 노출 조건: 메인("/") + (강제 ?tour=1  OR  아직 안 본 기기).
// SSR 깜빡임 방지: 마운트 후 useEffect에서만 노출 결정(OnboardingHint 패턴).
// ============================================

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TUTORIAL_STEPS } from "../config/steps";
import { hasSeenTutorial, markTutorialSeen } from "../storage";
import { SpotlightTour } from "./SpotlightTour";

/** 스텝 앵커 중 실제로 그려진(크기>0) 게 하나라도 있으면 콘텐츠 준비 완료로 본다. */
function anyAnchorVisible(): boolean {
  for (const step of TUTORIAL_STEPS) {
    const matches = document.querySelectorAll(step.selector);
    for (const node of matches) {
      const r = node.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) return true;
    }
  }
  return false;
}

export function TutorialGate() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 메인 화면에서만 (스텝 앵커가 전부 메인에 있음)
    if (pathname !== "/") {
      setShow(false);
      return;
    }
    let forced = false;
    try {
      forced = new URLSearchParams(window.location.search).get("tour") === "1";
    } catch {
      forced = false;
    }
    if (!forced && hasSeenTutorial()) return;

    // 스켈레톤(Suspense 로딩) 단계에 일찍 뜨지 않도록, 실제 콘텐츠(스텝 앵커)가
    // 화면에 그려질 때까지 기다렸다 띄움. 최대 ~6초 후엔 그냥 띄움(가운데 폴백).
    let tries = 0;
    let timer = 0;
    function attempt() {
      if (anyAnchorVisible() || tries >= 40) {
        setShow(true);
        return;
      }
      tries++;
      timer = window.setTimeout(attempt, 150);
    }
    timer = window.setTimeout(attempt, 400);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function finish() {
    markTutorialSeen();
    setShow(false);
  }

  if (!show) return null;
  return <SpotlightTour steps={TUTORIAL_STEPS} onFinish={finish} />;
}

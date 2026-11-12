"use client";

// ============================================
// 출산 준비물(/guide/birth-prep-list)로 가는 내부 링크 클릭 측정 — prep_inlink_click
//
// 제휴 카드(C214)는 birth-prep-list 한 편에만 있어서, 그 편으로 들어오는 유입이 곧 카드 노출이다.
// 어느 출발점(가이드 slug·home·explore)의 어느 자리(본문·함께 볼 가이드·홈 막달 줄)에서
// 넘어왔는지 센다. 링크 마크업(원고 생성물·next/link)은 건드리지 않고 문서 클릭을 위임으로 본다.
//
// payload: { from, zone }  — track()이 surface 를 자동으로 붙인다(/api/track 규칙 ^[a-z0-9_]+$·2KB 안).
//   from = 출발 slug(가이드) 또는 "home" · "explore"
//   zone = 가장 가까운 [data-track-zone] 값(guide_body · guide_related · home_prep · explore_stage), 없으면 "other"
// birth-prep-list 페이지 자신에서는 세지 않는다.
// ============================================

import { useEffect } from "react";
import { track } from "@/modules/analytics/service";

export const PREP_SLUG = "birth-prep-list";
export const PREP_PATH = `/guide/${PREP_SLUG}`;

export function PrepInlinkTracker({ fromSlug }: { fromSlug: string }) {
  useEffect(() => {
    if (fromSlug === PREP_SLUG) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let path: string;
      try {
        const u = new URL(a.href, window.location.href);
        if (u.origin !== window.location.origin) return;
        path = u.pathname.replace(/\/+$/, "");
      } catch {
        return;
      }
      if (path !== PREP_PATH) return;
      const zoneEl = a.closest("[data-track-zone]") as HTMLElement | null;
      track("prep_inlink_click", {
        from: fromSlug,
        zone: zoneEl?.dataset.trackZone ?? "other",
      });
    };
    // capture 단계 — next/link 가 이동을 시작하기 전에 잡는다(track 은 sendBeacon 우선이라 이동 중에도 전송).
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [fromSlug]);
  return null;
}

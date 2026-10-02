"use client";

// ============================================
// 인앱 브라우저 탈출 배너 — 상단 한 줄 "알림·관심 저장은 앱에서 돼요 → 앱으로 열기"
//
// - 인스타·네이버·카카오톡 웹뷰 UA에서만 노출 (shared/utils/inapp.ts)
// - Android(인스타·네이버): intent:// → TWA(com.umbba_radar.twa), 미설치면 플레이 스토어
// - 카카오톡(Android·iOS): kakaotalk://web/openExternal → 기본 브라우저
// - iOS(인스타·네이버): 스킴으로 Safari를 강제로 열 방법이 없어 "··· → Safari로 열기" 안내
// - 강제 리다이렉트 X — 닫을 수 있고, 닫으면 그 세션 동안 숨김(sessionStorage)
// - 계측: inapp_banner_impression / inapp_escape_click  { app, os, target }
// ============================================

import { useEffect, useState, useSyncExternalStore } from "react";
import { track } from "@/modules/analytics/service";
import {
  detectInApp,
  escapeActionFor,
  type InAppApp,
  type InAppOS,
  type EscapeAction,
  type InAppInfo,
} from "@/shared/utils/inapp";

const HIDE_KEY = "umbba-radar:inapp-banner-hidden";

const APP_LABEL: Record<InAppInfo["app"], string> = {
  instagram: "인스타그램",
  naver: "네이버",
  kakaotalk: "카카오톡",
};

// UA·세션 숨김 여부는 마운트 후에만 읽는다 (SSR 은 항상 미노출 → hydration 안전).
// 스냅샷은 비교 가능한 문자열 "app:os" (없으면 "").
const noopSubscribe = () => () => {};
function readSnapshot(): string {
  try {
    if (sessionStorage.getItem(HIDE_KEY) === "1") return "";
  } catch {
    // 무시
  }
  const d = detectInApp();
  return d ? `${d.app}:${d.os}` : "";
}

export function InAppBrowserBanner() {
  const snapshot = useSyncExternalStore(noopSubscribe, readSnapshot, () => "");
  const [hidden, setHidden] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const info: InAppInfo | null =
    snapshot && !hidden
      ? {
          app: snapshot.split(":")[0] as InAppApp,
          os: snapshot.split(":")[1] as InAppOS,
        }
      : null;

  // 노출 계측 — 레이아웃 마운트(풀 로드)당 1회
  useEffect(() => {
    if (!snapshot) return;
    const [app, os] = snapshot.split(":");
    track("inapp_banner_impression", { app, os });
  }, [snapshot]);

  if (!info) return null;

  const hide = () => {
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      // 무시
    }
    track("inapp_banner_dismiss", { app: info.app, os: info.os });
    setHidden(true);
  };

  const handleEscape = () => {
    const action: EscapeAction = escapeActionFor(info, window.location.href);
    track("inapp_escape_click", {
      app: info.app,
      os: info.os,
      target: action.kind === "link" ? action.target : "ios_guide",
    });
    if (action.kind === "link") {
      window.location.href = action.url;
    } else {
      setGuideOpen((v) => !v);
    }
  };

  const ctaLabel =
    info.app === "kakaotalk"
      ? "브라우저로 열기"
      : info.os === "ios"
        ? "Safari로 열기"
        : "앱으로 열기";

  return (
    <div
      role="region"
      aria-label="앱으로 열기 안내"
      className="relative z-30 border-b border-rose-100 bg-rose-50"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
        <span aria-hidden="true" className="shrink-0 text-base">
          🔔
        </span>
        <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-slate-700">
          알림·관심 저장은 앱에서 돼요
        </p>
        <button
          type="button"
          onClick={handleEscape}
          className="shrink-0 whitespace-nowrap rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-600"
        >
          {ctaLabel} →
        </button>
        <button
          type="button"
          onClick={hide}
          aria-label="닫기"
          className="-mr-1 shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-white/70 hover:text-slate-600"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      {guideOpen && (
        <div className="mx-auto max-w-6xl px-3 pb-2.5">
          <ol className="space-y-1 break-keep rounded-xl bg-white px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-600 shadow-sm">
            <li>
              1. {APP_LABEL[info.app]} 화면 오른쪽 위(또는 아래) <strong className="text-slate-900">···</strong> 메뉴를 눌러요
            </li>
            <li>
              2. <strong className="text-slate-900">Safari로 열기</strong>(외부 브라우저로 열기)를 선택해요
            </li>
            <li>
              3. Safari에서 <strong className="text-slate-900">공유 ⎋ → 홈 화면에 추가</strong>하면 알림도 받을 수 있어요
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}

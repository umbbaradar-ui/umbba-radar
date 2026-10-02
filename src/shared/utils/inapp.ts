// ============================================
// 인앱 브라우저(인스타·네이버·카카오톡 웹뷰) 감지 + "앱으로 열기" 링크 생성
//
// 2026-10 홍보안 ②: 30일 첫 방문의 50%가 인앱 웹뷰(인스타 36%·네이버 13%·카카오 1%).
// 웹뷰에선 웹푸시 구독·PWA 설치·구글 OAuth가 사실상 막혀 있어 관심 저장·알림 퍼널이
// 끊긴다 → 외부 브라우저/TWA 로 나가는 탈출구를 준다.
// ============================================

import { PLAY_PACKAGE_ID, PLAY_STORE_URL } from "./pwa";

export type InAppApp = "instagram" | "naver" | "kakaotalk";
export type InAppOS = "android" | "ios" | "other";

export interface InAppInfo {
  app: InAppApp;
  os: InAppOS;
}

/** UA 문자열 → 인앱 브라우저 정보 (아니면 null). 순수 함수 — 테스트·SSR 안전 */
export function detectInAppFromUA(ua: string): InAppInfo | null {
  let app: InAppApp | null = null;
  if (/KAKAOTALK/i.test(ua)) app = "kakaotalk";
  else if (/Instagram/i.test(ua)) app = "instagram";
  // 네이버앱 UA: "NAVER(inapp; search; ...)" — 네이버 웨일 브라우저(Whale)는 제외
  else if (/NAVER\(inapp|\bNAVER\//.test(ua)) app = "naver";
  if (!app) return null;

  const os: InAppOS = /Android/i.test(ua)
    ? "android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "ios"
      : "other";
  return { app, os };
}

export function detectInApp(): InAppInfo | null {
  if (typeof navigator === "undefined") return null;
  return detectInAppFromUA(navigator.userAgent);
}

/**
 * 안드로이드 intent:// — TWA(com.umbba_radar.twa) 설치돼 있으면 앱으로 같은 경로를 열고,
 * 없으면 browser_fallback_url(플레이 스토어)로 이동.
 * @param href 현재 페이지 절대 URL (https)
 */
export function buildAndroidIntentUrl(href: string): string {
  const u = new URL(href);
  const path = `${u.host}${u.pathname}${u.search}`;
  return (
    `intent://${path}#Intent;scheme=https;package=${PLAY_PACKAGE_ID};` +
    `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`
  );
}

/** 카카오톡 인앱 → 기본 외부 브라우저로 열기 (안드로이드·iOS 공통 스킴) */
export function buildKakaoExternalUrl(href: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
}

export type EscapeAction =
  | { kind: "link"; url: string; target: "twa_intent" | "kakao_external" }
  | { kind: "ios_guide" };

/** 인앱 정보 + 현재 URL → 배너 버튼 동작 */
export function escapeActionFor(info: InAppInfo, href: string): EscapeAction {
  if (info.app === "kakaotalk") {
    return { kind: "link", url: buildKakaoExternalUrl(href), target: "kakao_external" };
  }
  if (info.os === "android") {
    return { kind: "link", url: buildAndroidIntentUrl(href), target: "twa_intent" };
  }
  return { kind: "ios_guide" };
}

// ============================================
// 오픈 리다이렉트(피싱) 방지 — `next` 파라미터 정규화
//
// 로그인/온보딩 후 이동할 `next`는 "앱 내부 경로"만 허용한다.
// 외부 절대 URL(https://evil.com)·프로토콜 상대(//evil.com)·백슬래시 우회(/\evil.com)는
// 전부 폴백('/')으로 막는다. 클라이언트·서버 양쪽에서 동일하게 사용.
// ============================================

/** 문자열에 제어문자(개행·탭 등, U+0000~U+001F)가 있으면 true */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/** `next`가 안전한 내부 경로면 그대로, 아니면 fallback('/')을 반환 */
export function safeNext(next?: string | null, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  // 반드시 '/'로 시작해야 하고, '//'(프로토콜 상대)·'/\'(백슬래시 우회)는 외부로 샐 수 있어 차단
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // 제어문자/개행 등 비정상 입력 차단
  if (hasControlChar(next)) return fallback;
  return next;
}

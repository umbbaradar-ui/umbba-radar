import "server-only";

// ============================================
// 관리자 세션 — 보안 하드닝
//
// 기존: 쿠키값에 ADMIN_PASSWORD '원문'을 그대로 저장하고 `token !== password` 단순 비교.
//       → 쿠키 유출 시 비번 노출 + 비상수시간 비교 + 브루트포스 무방비.
// 변경: 쿠키에는 HMAC 서명 토큰(`${exp}.${hmac}`)만 담는다(평문 비번 X).
//       모든 검증을 이 모듈로 일원화(9곳 중복 제거). 비교는 crypto.timingSafeEqual.
//
// 서명 키: ADMIN_SESSION_SECRET 우선, 없으면 ADMIN_PASSWORD 재사용(새 env 없이 동작).
//          → 운영에서 ADMIN_SESSION_SECRET를 따로 두면 위생 향상(권장).
// ============================================

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE_NAME = "umbba-admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7일(초)

function adminSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

function hmac(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** 서명된 관리자 세션 토큰 발급 (`${exp}.${hmac}`). 평문 비밀번호를 쿠키에 담지 않음. */
export function signAdminToken(): string {
  const secret = adminSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET/ADMIN_PASSWORD env가 설정되지 않았어요.");
  }
  const exp = Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAX_AGE;
  return `${exp}.${hmac(secret, `admin:${exp}`)}`;
}

/** 쿠키 토큰 검증 — 만료·서명(상수시간) 확인. 시크릿/토큰 없으면 false. */
export function verifyAdminToken(token: string | undefined | null): boolean {
  const secret = adminSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  return safeEqualHex(token.slice(dot + 1), hmac(secret, `admin:${exp}`));
}

/** 동일 길이 hex 문자열 상수시간 비교 */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** 임의 길이 문자열을 sha256으로 정규화 후 상수시간 비교 (길이 노출·early-exit 방지) */
export function safeEqualStr(a: string, b: string): boolean {
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

/** 서버 컴포넌트/액션용 — 관리자 쿠키 없으면 /admin/login으로 리다이렉트 */
export async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    redirect("/admin/login");
  }
}

/** API 라우트용 — Bearer ADMIN_CLI_TOKEN(CLI) 또는 관리자 쿠키(웹) 둘 다 허용 */
export async function isAdminRequest(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization");
  if (auth) {
    const expected = process.env.ADMIN_CLI_TOKEN;
    return Boolean(expected) && safeEqualStr(auth, `Bearer ${expected}`);
  }
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

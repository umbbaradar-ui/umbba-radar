import "server-only";

// ============================================
// SSRF 방지 fetch — 서버가 임의 URL을 가져올 때 내부망 접근 차단
//
// 위험: extractFromUrl이 입력 URL과 og:image URL을 그대로 fetch → 사설/루프백/링크로컬
//       (169.254.169.254 메타데이터 등) 요청 유발 가능.
// 방어: 매 요청·리다이렉트 hop마다 호스트를 DNS 해석해 공인 IP인지 검증 + 타임아웃.
// 한계(잔여 리스크): DNS rebinding(검증 후 fetch가 재해석)은 글로벌 fetch에선 완전 차단 불가 —
//       트리거가 관리자 인증 뒤(medium)이고, hop 재검증으로 리다이렉트 우회는 막는다.
// ============================================

import dns from "node:dns/promises";
import net from "node:net";

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // 파싱 실패 = 차단
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true; // this-host, 사설, 루프백
  if (a === 169 && b === 254) return true; // 링크로컬(클라우드 메타데이터)
  if (a === 172 && b >= 16 && b <= 31) return true; // 사설
  if (a === 192 && b === 168) return true; // 사설
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // 멀티캐스트/예약
  return false;
}

function ipv6Private(ip: string): boolean {
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true; // 루프백/미지정
  if (low.startsWith("fe80")) return true; // 링크로컬
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // 유니크 로컬
  if (low.startsWith("::ffff:")) return ipv4Private(low.split(":").pop() || ""); // IPv4 매핑
  return false;
}

function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) return ipv6Private(ip);
  return true; // 알 수 없으면 차단
}

/** URL의 호스트가 공인 IP로만 해석되는지 확인(아니면 throw). http/https만 허용. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("잘못된 URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("http/https URL만 허용됩니다");
  }
  const host = u.hostname;
  let addrs: string[];
  if (net.isIP(host)) {
    addrs = [host];
  } else {
    const records = await dns.lookup(host, { all: true });
    addrs = records.map((r) => r.address);
  }
  if (addrs.length === 0) throw new Error("DNS 해석 실패");
  for (const ip of addrs) {
    if (isPrivateIp(ip)) {
      throw new Error("사설/내부 주소로의 요청은 차단됩니다(SSRF 방지)");
    }
  }
  return u;
}

interface SafeFetchOpts {
  maxRedirects?: number;
  timeoutMs?: number;
}

/**
 * SSRF 안전 fetch — 매 hop마다 공인 IP 재검증 + 타임아웃. 리다이렉트는 수동 추적(검증 후 재요청).
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  opts: SafeFetchOpts = {}
): Promise<Response> {
  const { maxRedirects = 3, timeoutMs = 8000 } = opts;
  let url = rawUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(url); // hop마다 검증(리다이렉트 우회 차단)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      url = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("리다이렉트가 너무 많습니다");
}

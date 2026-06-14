import "server-only";

// ============================================
// SSRF 방지 fetch — 서버가 임의 URL을 가져올 때 내부망 접근 차단
//
// 위험: extractFromUrl이 입력 URL과 og:image URL을 그대로 fetch → 사설/루프백/링크로컬
//       (169.254.169.254 메타데이터 등) 요청 유발 가능.
// 방어: 매 요청·리다이렉트 hop마다 호스트를 DNS 해석해 공인 IP인지 검증 + 타임아웃(헤더+본문).
//       본문은 스트리밍으로 누적하며 크기 상한 초과 시 즉시 취소.
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
  if (low.startsWith("ff")) return true; // 멀티캐스트
  if (low.startsWith("64:ff9b:")) return true; // NAT64 well-known prefix (사설 IPv4 실어나를 수 있음 → 보수적 차단)
  if (low.startsWith("::ffff:")) {
    // IPv4-매핑 — 점표기면 그대로, 16진형이면 마지막 두 그룹을 IPv4로 디코딩
    const rest = low.slice("::ffff:".length);
    if (rest.includes(".")) return ipv4Private(rest);
    const groups = rest.split(":");
    const g = groups.slice(-2);
    if (g.length === 2 && /^[0-9a-f]{1,4}$/.test(g[0]) && /^[0-9a-f]{1,4}$/.test(g[1])) {
      const n1 = parseInt(g[0], 16);
      const n2 = parseInt(g[1], 16);
      const dotted = `${(n1 >> 8) & 0xff}.${n1 & 0xff}.${(n2 >> 8) & 0xff}.${n2 & 0xff}`;
      return ipv4Private(dotted);
    }
    return true; // 해석 불가 = 차단
  }
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

interface FetchOpts {
  maxRedirects?: number;
  timeoutMs?: number;
}

// 리다이렉트를 수동 추적해 최종 응답까지 도달. 최종 hop의 abort 타이머는 살려서 반환
// (본문 다운로드까지 타임아웃이 적용되도록 — 호출부가 본문 소비 후 clear).
async function followToFinal(
  rawUrl: string,
  init: RequestInit,
  opts: FetchOpts
): Promise<{ res: Response; timer: ReturnType<typeof setTimeout> }> {
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
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const loc = res.headers.get("location");
      if (!loc) return { res, timer: setTimeout(() => {}, 0) };
      url = new URL(loc, url).toString();
      continue;
    }
    // 최종 응답 — timer는 본문 소비까지 유지(반환), 호출부 finally에서 clear
    return { res, timer };
  }
  throw new Error("리다이렉트가 너무 많습니다");
}

/** SSRF 안전 + 타임아웃이 본문까지 적용되는 텍스트 fetch */
export async function safeFetchText(
  rawUrl: string,
  init: RequestInit = {},
  opts: FetchOpts = {}
): Promise<{ ok: boolean; status: number; text: string }> {
  const { res, timer } = await followToFinal(rawUrl, init, opts);
  try {
    const text = await res.text(); // abort 타이머가 본문 단계도 보호
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/** SSRF 안전 + 타임아웃·크기상한(스트리밍)이 적용되는 바이너리 fetch */
export async function safeFetchBytes(
  rawUrl: string,
  init: RequestInit = {},
  opts: FetchOpts = {},
  maxBytes = 8 * 1024 * 1024
): Promise<{
  ok: boolean;
  status: number;
  bytes: Uint8Array;
  contentType: string;
}> {
  const { res, timer } = await followToFinal(rawUrl, init, opts);
  try {
    const contentType =
      res.headers.get("content-type")?.split(";")[0].trim() || "application/octet-stream";
    // Content-Length 선검사(있으면)
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > maxBytes) {
      throw new Error("응답이 너무 큽니다");
    }
    const reader = res.body?.getReader();
    if (!reader) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) throw new Error("응답이 너무 큽니다");
      return { ok: res.ok, status: res.status, bytes: buf, contentType };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel(); // 상한 초과 즉시 중단(다운로드 취소)
          throw new Error("응답이 너무 큽니다");
        }
        chunks.push(value);
      }
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return { ok: res.ok, status: res.status, bytes: out, contentType };
  } finally {
    clearTimeout(timer);
  }
}

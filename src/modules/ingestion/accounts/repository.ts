// ============================================
// instagram_accounts Supabase repository
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import type { AddAccountsResult, InstagramAccount } from "./types";

/**
 * 인스타 username 정규화
 * - @ 제거
 * - https://www.instagram.com/{name}/ 형태도 username 만 추출
 * - 소문자화 (인스타는 case-insensitive)
 * - 공백·특수문자 검증
 */
export function normalizeUsername(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // URL 형태면 path 에서 username 추출
  const urlMatch = s.match(
    /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?/i
  );
  if (urlMatch) s = urlMatch[1];
  // @ prefix 제거
  s = s.replace(/^@/, "");
  // 인스타 username 규칙: 영숫자, _, . 만
  if (!/^[A-Za-z0-9_.]{1,30}$/.test(s)) return null;
  return s.toLowerCase();
}

/**
 * username 일괄 추가 (정규화 + 중복 제거)
 */
export async function addUsernames(raws: string[]): Promise<AddAccountsResult> {
  const result: AddAccountsResult = {
    added: 0,
    skipped_duplicate: 0,
    invalid: 0,
    invalidUsernames: [],
  };

  // 1) 정규화 + in-batch 중복 제거
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const raw of raws) {
    const norm = normalizeUsername(raw);
    if (!norm) {
      if (raw.trim()) {
        result.invalid++;
        result.invalidUsernames.push(raw.trim().slice(0, 60));
      }
      continue;
    }
    if (seen.has(norm)) continue;
    seen.add(norm);
    valid.push(norm);
  }

  if (valid.length === 0) return result;

  // 2) 이미 있는 username 제외 (lower 매칭)
  const { data: existing } = await supabaseServer
    .from("instagram_accounts")
    .select("username")
    .in("username", valid);
  const existingSet = new Set(
    (existing ?? []).map((r) => (r.username as string).toLowerCase())
  );

  const toInsert = valid
    .filter((u) => {
      if (existingSet.has(u)) {
        result.skipped_duplicate++;
        return false;
      }
      return true;
    })
    .map((username) => ({ username, active: true }));

  if (toInsert.length === 0) return result;

  const { error, count } = await supabaseServer
    .from("instagram_accounts")
    .insert(toInsert, { count: "exact" });

  if (error) throw new Error(`계정 저장 실패: ${error.message}`);
  result.added = count ?? toInsert.length;
  return result;
}

export async function listAccounts(): Promise<InstagramAccount[]> {
  const { data, error } = await supabaseServer
    .from("instagram_accounts")
    .select("*")
    .order("active", { ascending: false })
    .order("username", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as InstagramAccount[];
}

export async function listActiveUsernames(): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("instagram_accounts")
    .select("username")
    .eq("active", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.username as string);
}

// CLI 신규-계정 첫스캔(과거 N일 백필) 판별용 — last_scanned_at(null=한번도 스캔 안 함)까지 노출.
export async function listActiveAccounts(): Promise<
  Array<{ username: string; last_scanned_at: string | null }>
> {
  const { data, error } = await supabaseServer
    .from("instagram_accounts")
    .select("username, last_scanned_at")
    .eq("active", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    username: r.username as string,
    last_scanned_at: (r.last_scanned_at as string | null) ?? null,
  }));
}

export async function setActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseServer
    .from("instagram_accounts")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabaseServer
    .from("instagram_accounts")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reportScanResult(
  username: string,
  newCount: number,
  errorMsg: string | null
): Promise<void> {
  const { error } = await supabaseServer
    .from("instagram_accounts")
    .update({
      last_scanned_at: new Date().toISOString(),
      last_new_count: newCount,
      last_error: errorMsg,
    })
    .eq("username", username.toLowerCase());
  if (error) throw new Error(error.message);
}

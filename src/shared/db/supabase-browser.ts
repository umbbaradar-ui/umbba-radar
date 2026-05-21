// ============================================
// 브라우저 Supabase 클라이언트 (쿠키 기반 세션)
// Client Component에서 사용 — 'use client' 파일에서 import
// ============================================

import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

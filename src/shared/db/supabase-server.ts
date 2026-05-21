// ============================================
// 서버 전용 Supabase 클라이언트 (service_role 키 사용)
// RLS를 우회하므로 절대 클라이언트에 노출되면 안 됨.
// 'use server' 컨텍스트나 Server Action에서만 import 할 것.
// ============================================

import "server-only";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
}
if (!SERVICE_ROLE_KEY) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseServer = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

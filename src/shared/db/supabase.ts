import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/**
 * 공개 읽기 전용 Supabase 클라이언트.
 * RLS 정책으로 published 카드만 노출됨.
 * Server Component·Client Component 양쪽에서 사용 가능.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

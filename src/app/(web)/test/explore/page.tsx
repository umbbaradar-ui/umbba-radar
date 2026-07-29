// ============================================
// /test/explore — 정식 /explore 로 승격됨 (2026-07)
// 미리보기 시절 링크·북마크 호환용 리다이렉트만 남김.
// ============================================

import { redirect } from "next/navigation";

export default function TestExplorePage() {
  redirect("/explore");
}

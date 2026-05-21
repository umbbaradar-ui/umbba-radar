// ============================================
// 마이 페이지 — /my
// 로컬스토리지에 저장된 사용자 체크 카드들
// ============================================

import { listPosts } from "@/modules/content/service";
import { MyPostsList } from "@/modules/personalization/ui/MyPostsList";

export const revalidate = 60;

export default async function MyPage() {
  const allPosts = await listPosts();
  return <MyPostsList posts={allPosts} />;
}

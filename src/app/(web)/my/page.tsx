// ============================================
// 마이 페이지 — /my
// 로컬스토리지에 저장된 사용자 체크 카드들
// ============================================

import { listPosts } from "@/modules/content/service";
import { MyPostsList } from "@/modules/personalization/ui/MyPostsList";
import { getUserStatusMap } from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";

// 로그인 사용자의 DB 데이터를 매 요청마다 fresh하게
export const dynamic = "force-dynamic";

export default async function MyPage() {
  const [allPosts, user] = await Promise.all([
    listPosts(),
    getCurrentUser(),
  ]);
  const statusMap = user ? await getUserStatusMap() : {};

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <AdSlot id="my_top" />
      </div>
      <MyPostsList
        posts={allPosts}
        loggedIn={Boolean(user)}
        initialStatusMap={statusMap}
      />
    </>
  );
}

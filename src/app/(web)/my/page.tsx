// ============================================
// 내 레이더 — /my
// 관심 / 신청함 / 과거 레이더 3탭
// ============================================

import { listPosts, listExpiredPosts } from "@/modules/content/service";
import { MyRadarTabs } from "@/modules/personalization/ui/MyRadarTabs";
import { getUserStatusMap } from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";

// 로그인 사용자의 DB 데이터를 매 요청마다 fresh하게
export const dynamic = "force-dynamic";

export default async function MyPage() {
  const [activePosts, expiredPosts, user] = await Promise.all([
    listPosts(),
    listExpiredPosts(),
    getCurrentUser(),
  ]);
  const statusMap = user ? await getUserStatusMap() : {};

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <AdSlot id="my_top" />
      </div>
      <MyRadarTabs
        activePosts={activePosts}
        expiredPosts={expiredPosts}
        loggedIn={Boolean(user)}
        initialStatusMap={statusMap}
      />
    </>
  );
}

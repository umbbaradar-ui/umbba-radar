// ============================================
// /test — 홈 미리보기 (로그인 상태별 화면 확인용)
//
// 실제 홈(/)과 동일한 HomeView를 렌더하되, 상태 스위처를 노출한다.
// ?view=guest  → 비로그인 화면 강제 (로그인 상태여도)
// ?view=member → 로그인+자녀 미등록 화면 강제
// ============================================

import type { Metadata } from "next";
import { listPosts } from "@/modules/content/service";
import { HomeView } from "@/modules/discovery/ui/HomeView";
import {
  getUserChildrenBirths,
  getUserStatusMap,
} from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { getStagesForChildren } from "@/shared/utils/stages";
import { kstTodayStartIso } from "@/shared/utils/dday";

export const revalidate = 60;

// 미리보기 페이지 — 검색엔진 인덱싱 금지
export const metadata: Metadata = {
  title: "홈 미리보기",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function TestHomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view =
    sp.view === "guest" || sp.view === "member" ? sp.view : "real";

  const [childrenBirths, user, statusMap, posts] = await Promise.all([
    getUserChildrenBirths(),
    getCurrentUser(),
    getUserStatusMap(),
    listPosts({}),
  ]);

  // 실제 상태
  let loggedIn = Boolean(user);
  let hasChildren = childrenBirths.length > 0;
  let myChildStages = hasChildren ? getStagesForChildren(childrenBirths) : [];
  let effectiveStatusMap = statusMap;

  // 미리보기용 상태 강제 (guest = 비로그인, member = 로그인+자녀 없음)
  if (view === "guest") {
    loggedIn = false;
    hasChildren = false;
    myChildStages = [];
    effectiveStatusMap = {};
  } else if (view === "member") {
    loggedIn = true;
    hasChildren = false;
    myChildStages = [];
  }

  return (
    <HomeView
      posts={posts}
      loggedIn={loggedIn}
      hasChildren={hasChildren}
      myChildStages={myChildStages}
      statusMap={effectiveStatusMap}
      todayStartIso={kstTodayStartIso()}
      previewMode={view}
    />
  );
}

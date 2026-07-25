// ============================================
// /test — 새 홈(마이레이더 + 엄빠레이더 추천) 미리보기
//
// 정식 반영 전 실데이터 검증용 페이지. 기존 홈(/)은 건드리지 않는다.
// 승인되면 이 페이지의 TestHomeView를 (web)/page.tsx로 이관하는 방식으로 교체.
//
// ?view=guest  → 비로그인 화면 강제 (로그인 상태여도)
// ?view=member → 로그인+자녀 미등록 화면 강제
// (기본은 실제 내 상태)
// ============================================

import type { Metadata } from "next";
import { listPosts } from "@/modules/content/service";
import {
  getUserChildrenBirths,
  getUserStatusMap,
} from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { getStagesForChildren } from "@/shared/utils/stages";
import { kstTodayStartIso } from "@/shared/utils/dday";
import { TestHomeView } from "./_components/TestHomeView";

export const revalidate = 60;

// 미리보기 페이지 — 검색엔진 인덱싱 금지
export const metadata: Metadata = {
  title: "새 홈 미리보기",
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
    <TestHomeView
      posts={posts}
      loggedIn={loggedIn}
      hasChildren={hasChildren}
      myChildStages={myChildStages}
      statusMap={effectiveStatusMap}
      todayStartIso={kstTodayStartIso()}
      viewMode={view}
    />
  );
}

// ============================================
// 메인 페이지 — 마이레이더 + 엄빠레이더 추천 2존 홈
// URL: /  (route group (web)는 URL에 안 나옴)
//
// 2026-07 홈 개편: 단일 그리드+필터 4행 → 섹션형 홈(HomeView).
// 전체 그리드·검색·필터는 /explore 로 분리.
// 예전 홈의 필터 URL(?stage=&type=&topic=&sort=&q=)로 들어오면
// 공유 링크·북마크 호환을 위해 /explore 로 리다이렉트.
// ============================================

import { redirect } from "next/navigation";
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

interface PageProps {
  searchParams: Promise<{
    stage?: string;
    type?: string;
    topic?: string;
    sort?: string;
    q?: string;
  }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // 구 홈 필터 URL 호환 — 필터·검색 파라미터가 있으면 /explore 로 이관
  const legacy = new URLSearchParams();
  if (sp.q?.trim()) legacy.set("q", sp.q.trim());
  if (sp.stage && sp.stage !== "all") legacy.set("stage", sp.stage);
  if (sp.type && sp.type !== "all") legacy.set("type", sp.type);
  if (sp.topic && sp.topic !== "all") legacy.set("topic", sp.topic);
  if (sp.sort === "created_desc") legacy.set("sort", "created_desc");
  if ([...legacy.keys()].length > 0) {
    redirect(`/explore?${legacy.toString()}`);
  }

  const [childrenBirths, user, statusMap, posts] = await Promise.all([
    getUserChildrenBirths(),
    getCurrentUser(),
    getUserStatusMap(),
    listPosts({}),
  ]);

  const hasChildren = childrenBirths.length > 0;
  const myChildStages = hasChildren ? getStagesForChildren(childrenBirths) : [];

  return (
    <HomeView
      posts={posts}
      loggedIn={Boolean(user)}
      hasChildren={hasChildren}
      myChildStages={myChildStages}
      statusMap={statusMap}
      todayStartIso={kstTodayStartIso()}
    />
  );
}

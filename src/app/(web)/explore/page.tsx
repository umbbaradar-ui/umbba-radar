// ============================================
// /explore — 전체 탐색 (검색 + 필터 + 그리드)
//
// 2026-07 홈 개편으로 신설: 홈은 섹션형 요약, 탐색은 전체 카드.
// 필터 바텀시트(다중선택 + N건 보기) + 전 상태 URL 동기화.
//
// URL 파라미터: q, stage(콤마 다중), type(콤마 다중), topic, sort, today=1
// ============================================

import type { Metadata } from "next";
import { listPosts } from "@/modules/content/service";
import { ExploreView } from "@/modules/discovery/ui/ExploreView";
import {
  getUserChildrenBirths,
  getUserStatusMap,
} from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { getStagesForChildren } from "@/shared/utils/stages";
import { kstTodayStartIso } from "@/shared/utils/dday";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "탐색 — 전체 혜택 모아보기",
  description:
    "임신·육아 협찬, 체험단, 증정 이벤트를 시기·유형별로 골라보세요.",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    type?: string;
    topic?: string;
    sort?: string;
    today?: string;
    focus?: string;
  }>;
}

function parseCsv(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const [childrenBirths, user, statusMap, posts] = await Promise.all([
    getUserChildrenBirths(),
    getCurrentUser(),
    getUserStatusMap(),
    listPosts({}),
  ]);

  const hasChildren = childrenBirths.length > 0;
  const myChildStages = hasChildren ? getStagesForChildren(childrenBirths) : [];

  return (
    <ExploreView
      posts={posts}
      loggedIn={Boolean(user)}
      hasChildren={hasChildren}
      myChildStages={myChildStages}
      statusMap={statusMap}
      todayStartIso={kstTodayStartIso()}
      initialQ={sp.q ?? ""}
      initialStages={parseCsv(sp.stage)}
      initialTypes={parseCsv(sp.type)}
      initialTopic={sp.topic ?? "all"}
      initialSort={sp.sort === "created_desc" ? "created_desc" : "deadline_asc"}
      initialToday={sp.today === "1"}
      autoFocusSearch={sp.focus === "1"}
    />
  );
}

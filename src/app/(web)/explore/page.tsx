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
    /** dev 전용: "parent" = 로그인+자녀(영아·유아) 상태 강제 (내 아이 필터 검수용) */
    preview?: string;
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

  let hasChildren = childrenBirths.length > 0;
  let myChildStages = hasChildren ? getStagesForChildren(childrenBirths) : [];
  let loggedIn = Boolean(user);

  // 개발 모드 전용 미리보기 — `?preview=parent` 면 로그인+자녀(영아·유아) 상태를 강제해
  // "내 아이" 필터(2섹션)를 계정 없이 검수한다. /test 페이지의 view 스위처와 같은 취지. 프로덕션에선 무시.
  if (process.env.NODE_ENV === "development" && sp.preview === "parent") {
    loggedIn = true;
    hasChildren = true;
    myChildStages = ["infant", "toddler"];
  }

  return (
    <ExploreView
      posts={posts}
      loggedIn={loggedIn}
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

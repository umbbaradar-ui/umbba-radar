// ============================================
// /test/explore — 새 탐색 페이지 미리보기
//
// 개선안 뼈대: 홈(브리핑)과 탐색(전체 그리드)의 분리.
// - 필터 pill 4행 → sticky 요약바 1행 + 바텀시트(다중선택 + "N건 보기")
// - 모든 필터 상태 URL 쿼리 동기화 → 상세 갔다 뒤로 와도·공유해도 유지
// - 검색·필터 전부 클라이언트 인메모리(현 규모 ≤300건) → 즉시 반응.
//   발행 1,000건 도달 시 서버 keyset 페이지네이션으로 전환할 것.
//
// URL 파라미터: q, stage(콤마 다중), type(콤마 다중), topic, sort, today=1
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
import { ExploreView } from "../_components/ExploreView";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "탐색 미리보기",
  robots: { index: false, follow: false },
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

export default async function TestExplorePage({ searchParams }: PageProps) {
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

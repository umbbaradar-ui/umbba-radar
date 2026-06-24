// ============================================
// 메인 페이지 — 카드 그리드 + 검색·필터·정렬
// URL: /  (route group (web)는 URL에 안 나옴)
//
// 서버: 발행 카드 전부 로드(+검색 q) + 사용자 자녀 시기 계산.
// 시기·유형·주제·정렬 필터는 DiscoveryView(클라이언트)에서 즉시 처리 → 클릭 시 서버 왕복 없음.
// ============================================

import { listPosts } from "@/modules/content/service";
import type { SortMode } from "@/modules/content/service";
import { DiscoveryView } from "@/modules/discovery/ui/DiscoveryView";
import {
  getUserChildrenBirths,
  getUserStatusMap,
} from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { getStagesForChildren } from "@/shared/utils/stages";
import { calcDDay, kstTodayStartIso } from "@/shared/utils/dday";
import type { StageCategory } from "@/shared/types/post";

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

function parseSort(s?: string): SortMode {
  if (s === "created_desc" || s === "deadline_desc") return s;
  return "deadline_asc";
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const type = sp.type ?? "all";
  const topic = sp.topic ?? "all";
  const sort = parseSort(sp.sort);
  const q = (sp.q ?? "").trim();

  // 자녀 시기 계산 (로그인 + 자녀 등록 사용자만 non-empty)
  // + 사용자 체크 상태(관심/신청) — 메인 그리드 정렬·표시용 (비로그인이면 {})
  const [childrenBirths, user, statusMap] = await Promise.all([
    getUserChildrenBirths(),
    getCurrentUser(),
    getUserStatusMap(),
  ]);
  const hasChildren = childrenBirths.length > 0;
  const myChildStages = hasChildren ? getStagesForChildren(childrenBirths) : [];

  // 디폴트 stage: 자녀 있으면 "my_child", 없으면 "all"
  const stage = sp.stage ?? (hasChildren ? "my_child" : "all");

  // 서버는 검색(q)만 처리 → 발행 카드 전부 로드. 나머지 필터·정렬은 클라이언트에서 즉시.
  const posts = await listPosts({ q });

  // "오늘의 스캔" 요약 — 이미 로드한 posts에서 계산(추가 DB 호출 0). 필터와 무관한 고정 배너용.
  // 자녀 있으면 my_child 필터(자녀 시기 ∪ 전연령)와 동일 기준으로 집계.
  const todayStartIso = kstTodayStartIso();
  const matching = hasChildren
    ? posts.filter((p) => {
        const tags = p.stage_categories;
        return (
          myChildStages.some((s) => tags.includes(s)) ||
          tags.includes("all_ages" as StageCategory)
        );
      })
    : posts;
  const scan = {
    newToday: matching.filter((p) => p.created_at >= todayStartIso).length,
    matchingTotal: matching.length,
    closingSoon: matching.filter((p) => {
      if (p.deadline_unknown) return false; // "상시" 카드는 마감 임박 아님
      const d = calcDDay(p.deadline);
      return d !== null && d.days >= 0 && d.days <= 3;
    }).length,
  };

  return (
    <DiscoveryView
      posts={posts}
      q={q}
      initialStage={stage}
      initialType={type}
      initialTopic={topic}
      initialSort={sort}
      myChildStages={myChildStages}
      hasChildren={hasChildren}
      scan={scan}
      loggedIn={Boolean(user)}
      initialStatusMap={statusMap}
    />
  );
}

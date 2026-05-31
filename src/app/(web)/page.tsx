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
import { getUserChildrenBirths } from "@/modules/personalization/service-server";
import { getStagesForChildren } from "@/shared/utils/stages";

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
  const childrenBirths = await getUserChildrenBirths();
  const hasChildren = childrenBirths.length > 0;
  const myChildStages = hasChildren ? getStagesForChildren(childrenBirths) : [];

  // 디폴트 stage: 자녀 있으면 "my_child", 없으면 "all"
  const stage = sp.stage ?? (hasChildren ? "my_child" : "all");

  // 서버는 검색(q)만 처리 → 발행 카드 전부 로드. 나머지 필터·정렬은 클라이언트에서 즉시.
  const posts = await listPosts({ q });

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
    />
  );
}

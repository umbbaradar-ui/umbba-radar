// ============================================
// 가이드 하단 위젯 — "이 시기 진행 중인 혜택"
//
// 카드 데이터는 기존 ContentService(listPosts)를 그대로 쓴다(새 쿼리 없음).
// - 시기: 가이드 시기와 정확 매칭 (탐색 시기 필터와 같은 기준, 전연령·리빙 제외)
// - 후기(review)·스폰서드(is_sponsored) 카드는 정보 글 아래에 두지 않는다
// - cardTypes 가 있으면(체험단 편 등) 그 유형을 먼저
// - 마감 임박순(listPosts 기본 정렬) 4장, 없으면 빈 상태
// Suspense 로 감싸 본문 렌더를 막지 않는다. DB 오류여도 페이지는 살린다.
// 고른 4장만 5분 캐시한다(검색 유입 페이지라 요청마다 발행 카드 전량을 읽지 않도록).
// ============================================

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { listPosts } from "@/modules/content/service";
import { PostCard } from "@/modules/content/ui/PostCard";
import { CardSlot } from "@/modules/analytics/ui/CardSlot";
import type { Post, StageCategory, TypeTag } from "@/shared/types/post";
import { STAGE_LABELS } from "@/shared/types/post";

const LIMIT = 4;

function pickPosts(
  posts: Post[],
  stages: StageCategory[],
  cardTypes: TypeTag[]
): Post[] {
  const candidates = posts.filter(
    (p) =>
      p.kind !== "review" &&
      !p.is_sponsored &&
      p.stage_categories.some((s) => stages.includes(s))
  );
  if (cardTypes.length === 0) return candidates.slice(0, LIMIT);
  const preferred = candidates.filter((p) =>
    p.type_tags.some((t) => cardTypes.includes(t))
  );
  const rest = candidates.filter((p) => !preferred.includes(p));
  return [...preferred, ...rest].slice(0, LIMIT);
}

const getGuidePosts = unstable_cache(
  async (stages: StageCategory[], cardTypes: TypeTag[]) =>
    pickPosts(await listPosts({}), stages, cardTypes),
  ["guide-benefits-v1"],
  { revalidate: 300 }
);

function exploreHref(stages: StageCategory[]): string {
  return `/explore?stage=${stages.join(",")}`;
}

export async function GuideBenefits({
  slug,
  stages,
  cardTypes,
}: {
  slug: string;
  stages: StageCategory[];
  cardTypes: TypeTag[];
}) {
  let posts: Post[] = [];
  try {
    posts = await getGuidePosts(stages, cardTypes);
  } catch (e) {
    console.error("[guide] benefits widget failed:", e);
  }

  const stageText = stages.map((s) => STAGE_LABELS[s] ?? s).join("·");

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-4 py-6 text-center ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-700">
          지금은 {stageText} 시기 혜택 카드가 없어요.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          새 카드는 매일 올라와요. 전체 혜택에서 다른 시기도 볼 수 있어요.
        </p>
        <Link
          href="/explore"
          className="mt-3 inline-block rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
        >
          전체 혜택 보기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {posts.map((post, i) => (
          <CardSlot
            key={post.id}
            postId={post.id}
            zone="guide_benefits"
            position={i}
            listLen={posts.length}
            meta={{ guide: slug }}
          >
            <PostCard post={post} />
          </CardSlot>
        ))}
      </div>
      <Link
        href={exploreHref(stages)}
        className="mt-3 block rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      >
        {stageText} 혜택 더 보기 →
      </Link>
    </div>
  );
}

export function GuideBenefitsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
      {Array.from({ length: LIMIT }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white">
          <div className="skeleton aspect-square w-full" />
          <div className="space-y-2 px-4 py-3">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

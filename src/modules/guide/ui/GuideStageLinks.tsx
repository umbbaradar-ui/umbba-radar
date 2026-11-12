// ============================================
// 시기 화면 → 가이드 내부 링크 (탐색 시기 필터·홈 시기 허브 아래)
// 클라이언트 컴포넌트에서도 쓰므로 본문 없는 catalog 만 import 한다.
// (C219) 임신·신생아 칩 줄은 출산 준비물을 맨 앞에 고정하고, 그 칩 클릭을 prep_inlink_click 으로 센다.
// ============================================

"use client";

import Link from "next/link";
import { track } from "@/modules/analytics/service";
import type { StageCategory } from "@/shared/types/post";
import { STAGE_LABELS } from "@/shared/types/post";
import { GUIDE_CATALOG } from "../content/catalog";

const PREP_SLUG = "birth-prep-list";

/** 탐색 화면: 시기 필터가 하나일 때 그 시기 가이드 칩 줄 */
export function GuideStageLinks({
  stage,
  limit = 4,
}: {
  stage: StageCategory;
  limit?: number;
}) {
  const inStage = GUIDE_CATALOG.filter((g) => g.stages.includes(stage));
  if (inStage.length === 0) return null;
  // 출산 준비물(제휴 카드가 있는 편)은 해당 시기 칩 줄 맨 앞에 — 나머지 순서는 그대로
  const pinned = inStage.filter((g) => g.slug === PREP_SLUG);
  const guides = [...pinned, ...inStage.filter((g) => g.slug !== PREP_SLUG)];
  return (
    <nav
      aria-label={`${STAGE_LABELS[stage]} 시기 가이드`}
      data-track-zone="explore_stage"
      className="mb-3 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <span className="shrink-0 text-[11px] font-bold text-slate-500">
        📘 {STAGE_LABELS[stage]} 가이드
      </span>
      {guides.slice(0, limit).map((g) => (
        <Link
          key={g.slug}
          href={`/guide/${g.slug}`}
          onClick={
            g.slug === PREP_SLUG
              ? () => track("prep_inlink_click", { from: "explore", zone: "explore_stage" })
              : undefined
          }
          className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          {g.label}
        </Link>
      ))}
      <Link
        href={`/guide?stage=${stage}`}
        className="shrink-0 px-1 text-xs font-bold text-rose-600"
      >
        전체 →
      </Link>
    </nav>
  );
}

/** 홈 시기 허브 아래: 가이드 목록 진입 한 줄 */
export function GuideHubLink() {
  if (GUIDE_CATALOG.length === 0) return null;
  return (
    <Link
      href="/guide"
      className="mt-2 flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-xs ring-1 ring-slate-200 hover:bg-slate-50"
    >
      <span className="font-bold text-slate-800">
        📘 시기별 가이드 — 지원금·접종·체크리스트
      </span>
      <span className="shrink-0 font-bold text-rose-600">{GUIDE_CATALOG.length}편 →</span>
    </Link>
  );
}

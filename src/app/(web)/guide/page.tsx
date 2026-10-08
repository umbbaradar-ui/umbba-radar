// ============================================
// /guide — 시기별 가이드 목록
// 시기 탭(?stage=)·분류 탭(?category=)은 같은 페이지의 거르기일 뿐이라
// canonical 은 항상 /guide 하나로 둔다(중복 색인 방지).
// ============================================

import type { Metadata } from "next";
import Link from "next/link";
import type { StageCategory } from "@/shared/types/post";
import { STAGE_LABELS } from "@/shared/types/post";
import {
  GUIDE_CATEGORY_LABELS,
  GUIDE_CATEGORY_ORDER,
  GUIDE_STAGE_ORDER,
  formatGuideDate,
} from "@/modules/guide/constants";
import { plainText } from "@/modules/guide/inline";
import {
  guideBreadcrumbJsonLd,
  guideListJsonLd,
  serializeJsonLd,
} from "@/modules/guide/jsonld";
import { listGuides } from "@/modules/guide/service";
import type { GuideCategory } from "@/modules/guide/types";

const DESCRIPTION =
  "임신부터 아이가 자랄 때까지 시기별로 챙길 지원금·신청 기한·검진·체크리스트를 공식 출처와 확인일을 붙여 정리했어요.";

export const metadata: Metadata = {
  title: "시기별 가이드 — 지원금·검진·체크리스트 · 엄빠레이더",
  description: DESCRIPTION,
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "시기별 가이드 — 지원금·검진·체크리스트 · 엄빠레이더",
    description: DESCRIPTION,
    url: "/guide",
    siteName: "엄빠레이더",
    locale: "ko_KR",
    type: "website",
  },
};

interface PageProps {
  searchParams: Promise<{ stage?: string; category?: string }>;
}

function isGuideStage(v: string | undefined): v is StageCategory {
  return !!v && (GUIDE_STAGE_ORDER as readonly string[]).includes(v);
}
function isGuideCategory(v: string | undefined): v is GuideCategory {
  return !!v && (GUIDE_CATEGORY_ORDER as readonly string[]).includes(v);
}

function tabHref(stage?: StageCategory, category?: GuideCategory): string {
  const p = new URLSearchParams();
  if (stage) p.set("stage", stage);
  if (category) p.set("category", category);
  const qs = p.toString();
  return qs ? `/guide?${qs}` : "/guide";
}

export default async function GuideListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const stage = isGuideStage(sp.stage) ? sp.stage : undefined;
  const category = isGuideCategory(sp.category) ? sp.category : undefined;

  const all = listGuides();
  const shown = all.filter(
    (g) => (!stage || g.stages.includes(stage)) && (!category || g.category === category)
  );
  const groups = GUIDE_CATEGORY_ORDER.map((c) => ({
    category: c,
    guides: shown.filter((g) => g.category === c),
  })).filter((grp) => grp.guides.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-4 break-keep">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(guideBreadcrumbJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(guideListJsonLd(all)) }}
      />

      <header className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 md:text-[26px]">
          시기별 가이드
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">
          지금 시기에 챙길 지원금·신청 기한·검진을 질문 하나에 답 하나로 정리했어요. 모든
          글에 공식 출처와 확인일을 붙였어요.
        </p>
      </header>

      <nav aria-label="시기 고르기" className="mb-2">
        <ul className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabItem href={tabHref(undefined, category)} active={!stage} label="전체 시기" />
          {GUIDE_STAGE_ORDER.map((s) => (
            <TabItem
              key={s}
              href={tabHref(s, category)}
              active={stage === s}
              label={STAGE_LABELS[s]}
            />
          ))}
        </ul>
      </nav>
      <nav aria-label="분류 고르기" className="mb-5">
        <ul className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabItem href={tabHref(stage, undefined)} active={!category} label="전체 분류" tone="sub" />
          {GUIDE_CATEGORY_ORDER.map((c) => (
            <TabItem
              key={c}
              href={tabHref(stage, c)}
              active={category === c}
              label={GUIDE_CATEGORY_LABELS[c]}
              tone="sub"
            />
          ))}
        </ul>
      </nav>

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-white px-4 py-8 text-center ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-700">이 조건의 가이드는 준비 중이에요.</p>
          <Link href="/guide" className="mt-2 inline-block text-sm font-bold text-rose-600">
            전체 가이드 보기 →
          </Link>
        </div>
      ) : (
        groups.map((grp) => (
          <section key={grp.category} aria-labelledby={`cat-${grp.category}`} className="mb-7">
            <h2
              id={`cat-${grp.category}`}
              className="mb-2 text-base font-extrabold tracking-tight text-slate-900"
            >
              {GUIDE_CATEGORY_LABELS[grp.category]}{" "}
              <span className="text-sm font-bold text-slate-500">{grp.guides.length}</span>
            </h2>
            <ul className="space-y-2.5">
              {grp.guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/guide/${g.slug}`}
                    className="block rounded-2xl bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)]"
                  >
                    <h3 className="text-[15px] font-bold leading-snug text-slate-900">{g.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-600">
                      {plainText(g.summary[0] ?? "")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {g.stages.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700"
                        >
                          {STAGE_LABELS[s]}
                        </span>
                      ))}
                      <span className="ml-auto text-[10px] text-slate-500">
                        확인 {formatGuideDate(g.checkedAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Link
        href="/explore"
        className="mt-4 block rounded-2xl bg-slate-900 px-4 py-3.5 text-center text-sm font-bold text-white hover:bg-slate-800"
      >
        진행 중인 체험단·이벤트 보러 가기
      </Link>
    </main>
  );
}

function TabItem({
  href,
  active,
  label,
  tone = "main",
}: {
  href: string;
  active: boolean;
  label: string;
  tone?: "main" | "sub";
}) {
  const activeClass = tone === "main" ? "bg-slate-900 text-white" : "bg-rose-600 text-white";
  return (
    <li className="shrink-0">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`block rounded-full px-3 py-1.5 text-xs font-bold transition ${
          active ? activeClass : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}

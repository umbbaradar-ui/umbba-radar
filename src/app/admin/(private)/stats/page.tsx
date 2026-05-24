// ============================================
// 관리자 통계 대시보드 — /admin/stats
// MAU·카드 클릭률·채널 분포·인기 카드 등 한눈에
// ============================================

import Link from "next/link";
import { getAdminStats } from "@/modules/curation/service";
import {
  STAGE_LABELS,
  TYPE_LABELS,
  ACTIVE_TYPE_TAGS,
  SOURCE_TYPE_LABELS,
  type SourceType,
} from "@/shared/types/post";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export const dynamic = "force-dynamic";

function parsePeriod(s?: string): number {
  if (s === "1") return 1;
  if (s === "30") return 30;
  if (s === "90") return 90;
  return 7;
}

export default async function AdminStatsPage({ searchParams }: PageProps) {
  const { period } = await searchParams;
  const periodDays = parsePeriod(period);
  const stats = await getAdminStats(periodDays);

  const ctrPct = (stats.ctr * 100).toFixed(1);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            통계 대시보드
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            최근 {periodDays}일 기준 · 이벤트 데이터는 events 테이블
          </p>
        </div>
        <div className="flex gap-1.5">
          {[1, 7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/admin/stats?period=${d}`}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                periodDays === d
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {d === 1 ? "오늘" : `${d}일`}
            </Link>
          ))}
        </div>
      </header>

      {/* 핵심 지표 4개 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="고유 방문자 (UU)"
          value={stats.uniqueUsers.toLocaleString()}
          hint={`최근 ${periodDays}일`}
        />
        <MetricCard
          label="카드 클릭"
          value={stats.events.card_click.toLocaleString()}
          hint={`평균 ${(stats.events.card_click / Math.max(stats.uniqueUsers, 1)).toFixed(1)} 회/UU`}
        />
        <MetricCard
          label="원문 클릭"
          value={stats.events.source_link_click.toLocaleString()}
          hint="외부 인스타로 이동"
        />
        <MetricCard
          label="원문 클릭률 (CTR)"
          value={`${ctrPct}%`}
          hint="결정적 KPI · 15% 이상 양호"
          highlight={stats.ctr >= 0.15}
        />
      </section>

      {/* 카드 현황 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SubMetric label="전체 카드" value={stats.totals.posts} />
        <SubMetric label="발행 중" value={stats.totals.published} accent="emerald" />
        <SubMetric label="승인 대기" value={stats.totals.pending} accent="amber" />
        <SubMetric label="초안" value={stats.totals.draft} />
        <SubMetric label="마감" value={stats.totals.expired} accent="slate" />
      </section>

      {/* 행동 이벤트 분포 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">행동 이벤트</h2>
        <div className="space-y-2 text-sm">
          <EventBar label="카드 클릭" count={stats.events.card_click} max={stats.events.card_click} />
          <EventBar label="원문 클릭" count={stats.events.source_link_click} max={stats.events.card_click} />
          <EventBar label="신청함/관심 체크" count={stats.events.status_mark} max={stats.events.card_click} />
          <EventBar label="검색" count={stats.events.search} max={stats.events.card_click} />
          <EventBar label="로그인 시도" count={stats.events.login_attempt} max={stats.events.card_click} />
          <EventBar label="가입 시도" count={stats.events.signup_attempt} max={stats.events.card_click} />
        </div>
      </section>

      {/* 채널 분포 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">카드 채널 분포</h2>
        <div className="space-y-2">
          {(["admin", "ingestion", "submission"] as SourceType[]).map((s) => (
            <ProgressBar
              key={s}
              label={SOURCE_TYPE_LABELS[s]}
              value={stats.bySource[s] ?? 0}
              total={stats.totals.posts}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 시기 분포 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">발행 카드 — 시기 분포</h2>
          <div className="space-y-2">
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <ProgressBar
                key={k}
                label={v}
                value={stats.byStage[k] ?? 0}
                total={stats.totals.published || 1}
              />
            ))}
          </div>
        </section>

        {/* 유형 분포 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">발행 카드 — 유형 분포</h2>
          <div className="space-y-2">
            {ACTIVE_TYPE_TAGS.map((k) => (
              <ProgressBar
                key={k}
                label={TYPE_LABELS[k]}
                value={stats.byType[k] ?? 0}
                total={stats.totals.published || 1}
              />
            ))}
          </div>
        </section>
      </div>

      {/* 인기 카드 Top 10 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">
          인기 카드 Top 10 (최근 {periodDays}일)
        </h2>
        {stats.topCards.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            아직 클릭 데이터가 없어요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                <tr>
                  <th className="py-2 font-medium">제목</th>
                  <th className="py-2 text-right font-medium">카드 클릭</th>
                  <th className="py-2 text-right font-medium">원문 클릭</th>
                  <th className="py-2 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.topCards.map((c) => (
                  <tr key={c.post_id} className="hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/admin/${c.post_id}/edit`}
                        className="line-clamp-1 text-slate-900 hover:text-rose-600"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono text-slate-700">
                      {c.card_clicks}
                    </td>
                    <td className="py-2 text-right font-mono text-slate-700">
                      {c.source_clicks}
                    </td>
                    <td
                      className={`py-2 text-right font-mono font-bold ${
                        c.ctr >= 0.15
                          ? "text-emerald-600"
                          : c.ctr >= 0.05
                            ? "text-amber-600"
                            : "text-slate-400"
                      }`}
                    >
                      {(c.ctr * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="pb-4 text-center text-[11px] text-slate-400">
        통계는 페이지 진입 시점 기준. 새로고침으로 최신화.
      </p>
    </main>
  );
}

// ============================================
// 컴포넌트
// ============================================

function MetricCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm ${
        highlight ? "ring-2 ring-emerald-300" : ""
      }`}
    >
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const ACCENT_COLOR: Record<string, string> = {
  emerald: "text-emerald-700 bg-emerald-50",
  amber: "text-amber-700 bg-amber-50",
  slate: "text-slate-600 bg-slate-100",
};

function SubMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: keyof typeof ACCENT_COLOR;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${accent ? ACCENT_COLOR[accent] : "bg-white text-slate-700"} shadow-sm`}
    >
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold">{value}</p>
    </div>
  );
}

function EventBar({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-slate-600">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-rose-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-xs text-slate-700">
        {count.toLocaleString()}
      </span>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-slate-600">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-slate-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-xs text-slate-700">
        {value} ({pct.toFixed(0)}%)
      </span>
    </div>
  );
}

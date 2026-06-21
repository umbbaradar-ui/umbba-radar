// ============================================
// 수집 파이프라인 현황 대시보드 — /admin 상단
// 모니터링 계정 → 미분류(draft) → 검수 대기(pending) → 발행(published) 퍼널
// (BD 수집 → 로컬 Claude 분류 → 검수 구조. docs/COLLECTION-DIRECTION-FINAL-2026-06-21.md)
// ============================================

import Link from "next/link";
import type { PipelineStats } from "@/modules/curation/service";

// 최근 24시간 수집이 이 값 미만이면 "수집 저조" 경고
const LOW_COLLECT_THRESHOLD = 5;
// 미분류(draft)가 이 값 이상 쌓이면 "분류 루틴 점검" 경고
const DRAFT_PILE_THRESHOLD = 30;

function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

export function PipelineDashboard({ stats }: { stats: PipelineStats }) {
  const low = stats.last24h.collected < LOW_COLLECT_THRESHOLD;
  const draftPiling = stats.draftTotal >= DRAFT_PILE_THRESHOLD;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold tracking-tight text-slate-800">
          📊 수집 파이프라인 현황
        </h2>
        <span className="text-[11px] text-slate-400">최근 24시간 / 7일</span>
      </div>

      {/* 수집 저조 경고 */}
      {low && (
        <div className="mb-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          ⚠️ 최근 24시간 수집 <strong>{stats.last24h.collected}건</strong> —
          평소보다 적어요. BD 수집 루틴(bd_ingest --raw) 작동을 점검하세요.
        </div>
      )}
      {/* 분류 정체 경고 — 수집은 되는데 미분류가 쌓임 = 분류 루틴 문제 */}
      {draftPiling && (
        <div className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
          ⚠️ 미분류 카드 <strong>{stats.draftTotal}건</strong> 쌓임 — 분류
          루틴(bd_classify, 로컬 Claude) 작동을 점검하세요.
        </div>
      )}

      {/* 퍼널: 계정 → 미분류 → 검수대기 → 발행 */}
      <div className="flex flex-wrap items-stretch gap-2">
        <FunnelStat icon="📡" label="모니터링 계정" value={stats.accountsActive} />
        <Arrow sub={`+${stats.last24h.collected} / 24h`} />
        <FunnelStat icon="🗂️" label="미분류 (draft)" value={stats.draftTotal} />
        <Arrow sub="분류" />
        <FunnelStat
          icon="📝"
          label="검수 대기 (pending)"
          value={stats.pendingTotal}
          href="/admin/queue"
        />
        <Arrow sub="검수" />
        <FunnelStat icon="✅" label="발행 (누적)" value={stats.publishedTotal} />
      </div>

      {/* 최근 7일 일별 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-[11px] text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">날짜 (KST)</th>
              <th className="px-3 py-2 text-right font-medium">수집</th>
              <th className="px-3 py-2 text-right font-medium">발행</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {stats.daily.map((d, i) => (
              <tr key={d.date} className={i === 0 ? "bg-emerald-50/40" : ""}>
                <td className="px-3 py-1.5 text-slate-700">
                  {fmtDay(d.date)}
                  {i === 0 && (
                    <span className="ml-1 text-[10px] text-emerald-600">오늘</span>
                  )}
                </td>
                <td
                  className={`px-3 py-1.5 text-right tabular-nums ${
                    d.collected === 0 ? "text-slate-300" : "text-slate-800"
                  }`}
                >
                  {d.collected}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                  {d.published}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        수집 = BD가 만든 미분류(draft) 카드 · 발행 = 검수 후 승인된 것. 분류(미분류
        → 검수 대기)는 로컬 Claude가 처리. (일자는 등록 시각 기준)
      </p>
    </section>
  );
}

function FunnelStat({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="flex min-w-[110px] flex-1 flex-col items-center justify-center rounded-xl bg-slate-50 px-3 py-3">
      <span className="text-base" aria-hidden>
        {icon}
      </span>
      <span className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900">
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="flex flex-1 transition hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Arrow({ sub }: { sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1">
      <span className="text-lg text-slate-300" aria-hidden>
        →
      </span>
      <span className="text-[10px] font-medium text-slate-400">{sub}</span>
    </div>
  );
}

// ============================================
// URL 큐 일괄 등록 — /admin/bulk-ingest
//
// 흐름 (2026-09-20 맥 1시간 러너로 자동화):
//   1) 관리자가 인스타 게시물 URL 들을 textarea 에 줄바꿈으로 입력
//   2) Server Action 이 URL 정규화 + 중복 제거 → ingest_queue 에 'todo' 로 저장
//   3) 맥 launchd(com.umbba.bdqueue, 매시 정각) bd-queue.sh 가 'todo' 를 가져가
//      BD 게시물 URL 직접 수집 → draft → 로컬 Claude 분류 → 2차 검수 → 'done'/'duplicate'/'failed'
//   4) 결과 카드는 /admin/queue 승인대기(pending) 로 진입 — pass 85+ 는 09:00 자동 발행
//
// 이 페이지에서는 URL 입력 + 큐 상태 모니터링만 담당. 실제 처리는 맥이 백그라운드로 진행.
// ============================================

import Link from "next/link";
import { BulkIngestForm } from "./BulkIngestForm";
import { QueueList } from "./QueueList";
import { LocalModePanel } from "./LocalModePanel";
import { getQueueStats, listQueue } from "@/modules/ingestion/queue/repository";

export const dynamic = "force-dynamic";

export default async function BulkIngestPage() {
  const [stats, items] = await Promise.all([
    getQueueStats(),
    listQueue(100),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-6">
        <Link
          href="/admin"
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          ← 관리자 홈
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          ② URL 큐 <span className="text-sm font-medium text-slate-400">(수동 URL 등록)</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          <strong>등록만 하면 나머지는 자동</strong> — 인스타 게시물 URL을 넣어두면
          맥 자동 루틴이 <strong>매시 정각</strong>에 가져가 수집·AI 분류·2차 검수까지
          끝냅니다 (등록 후 최대 1시간). 계정 스캔이 아니라 넣은 게시물만 수집해요.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          결과 카드는{" "}
          <Link
            href="/admin/queue"
            className="text-rose-600 underline hover:text-rose-700"
          >
            /admin/queue
          </Link>{" "}
          (승인대기) 에 모입니다 → 검수 점수 85+ 는 다음날 09:00 자동 발행, 나머지는 검수 후 발행.
        </p>
      </header>

      {/* 통계 카드 */}
      <section className="mb-5 grid grid-cols-5 gap-2 text-center">
        <StatCard label="대기" value={stats.todo} color="slate" />
        <StatCard label="처리중" value={stats.processing} color="amber" />
        <StatCard label="완료" value={stats.done} color="emerald" />
        <StatCard label="중복" value={stats.duplicate} color="zinc" />
        <StatCard label="실패" value={stats.failed} color="rose" />
      </section>

      <BulkIngestForm />

      <div className="mt-6">
        <LocalModePanel todoCount={stats.todo} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-slate-900">
          최근 큐 항목{" "}
          <span className="text-xs font-normal text-slate-400">
            (최근 3일 · 기본 대기 탭, 다른 상태는 탭 클릭)
          </span>
        </h2>
        <QueueList items={items} />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 text-xs leading-relaxed text-slate-600 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-900">💡 운영 흐름</h2>
        <ul className="space-y-1.5 pl-4 list-disc">
          <li>
            <strong>큐 등록</strong>: 인스타 URL 정규화 후 중복 제거 (이미 큐에
            있거나 이미 카드로 등록된 URL은 자동 스킵).
          </li>
          <li>
            <strong>맥 자동 처리</strong>: 맥 launchd(
            <code className="rounded bg-slate-100 px-1">com.umbba.bdqueue</code>)가
            매시 정각 <code className="rounded bg-slate-100 px-1">bd-queue.sh</code> 실행
            → 대기 URL(회차당 최대 40개)을 Bright Data로 직접 수집 → 로컬 Claude 분류
            → 2차 검수. 큐가 비어 있으면 아무것도 안 함(비용 0). 새벽 3시 정기 수집과
            겹치면 그 시간만 건너뜀.
          </li>
          <li>
            <strong>실패 항목</strong>: 비공개·삭제 게시물, 게시물이 아닌 URL(프로필·블로그),
            이미지 없음 등은 status=failed + 사유 기록. 재시도 버튼으로 다시 todo 화 가능.
          </li>
          <li>
            <strong>중복 항목</strong>: 처리해보니 이미 같은 카드가 있어 건너뛴 경우
            status=duplicate.
          </li>
          <li>
            <strong>수동 백업</strong>: 맥이 꺼져 있을 땐 아래 로컬 분석 모드(Export → Claude
            Code → Import)로 직접 처리할 수 있어요.
          </li>
        </ul>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "amber" | "emerald" | "zinc" | "rose";
}) {
  const colorMap = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    zinc: "bg-zinc-50 text-zinc-600 border-zinc-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  } as const;
  return (
    <div className={`rounded-xl border px-2 py-3 ${colorMap[color]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
    </div>
  );
}

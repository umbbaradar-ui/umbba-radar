// ============================================
// URL 큐 일괄 등록 — /admin/bulk-ingest
//
// 흐름 (Phase 2 큐 자동화):
//   1) 관리자가 인스타 URL 들을 textarea 에 줄바꿈으로 입력
//   2) Server Action 이 URL 정규화 + 중복 제거 → ingest_queue 에 'todo' 로 저장
//   3) 로컬 PC 의 CLI 가 1시간마다 'todo' N개를 pull → 다운로드 + Claude 분류 → 'done'/'failed'
//   4) 결과 카드는 /admin/queue 의 검수 큐로 자동 진입 (pending)
//
// 이 페이지에서는 URL 입력 + 큐 상태 모니터링만 담당.
// 실제 처리는 CLI 가 백그라운드로 진행.
// ============================================

import Link from "next/link";
import { BulkIngestForm } from "./BulkIngestForm";
import { QueueList } from "./QueueList";
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
          URL 일괄 등록 큐
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          <strong>발견은 자동, 처리는 수동 (A모드)</strong> — CLI{" "}
          <code className="rounded bg-slate-100 px-1">--scan</code> 이 인스타 신규
          게시물 URL 만 큐에 쌓아둡니다. 캡션 미리보기 보고 노이즈는{" "}
          <strong>[삭제]</strong> 로 거른 다음, 처리할 것만{" "}
          <code className="rounded bg-slate-100 px-1">--pull</code> 로 분석
          (카드당 ~24원).
        </p>
        <p className="mt-1 text-xs text-slate-500">
          분석된 카드는{" "}
          <Link
            href="/admin/queue"
            className="text-rose-600 underline hover:text-rose-700"
          >
            /admin/queue
          </Link>{" "}
          (승인대기) 에 모입니다 → 검수 후 발행.
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

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-slate-900">
          최근 큐 항목 (최대 100개)
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
            <strong>CLI 자동 처리</strong>: 로컬 PC 의 Windows 작업 스케줄러가
            1시간마다 <code className="rounded bg-slate-100 px-1">py ingest.py --pull</code>{" "}
            실행. todo 5개 가져와서 처리 후 결과 보고.
          </li>
          <li>
            <strong>실패 항목</strong>: 인스타 비공개·삭제·쿠키 만료 등으로
            실패하면 status=failed + 에러 메시지 기록. 재시도 버튼으로 다시 todo
            화 가능.
          </li>
          <li>
            <strong>중복 항목</strong>: CLI 가 처리해보니 이미 같은 카드가 있어
            건너뛴 경우 status=duplicate.
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

// ============================================
// 인스타 모니터링 계정 관리 — /admin/accounts
// CLI --scan 모드가 매일 저녁 활성 계정의 신규 게시물 발견 → 큐 자동 push
// ============================================

import Link from "next/link";
import { listAccounts } from "@/modules/ingestion/accounts/repository";
import { AccountForm } from "./AccountForm";
import { AccountList } from "./AccountList";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const accounts = await listAccounts();
  const active = accounts.filter((a) => a.active).length;
  const inactive = accounts.length - active;

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
          팔로잉 계정 모니터링
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          여기 등록된 계정의 <strong>신규 게시물 URL</strong>을 매일 저녁 CLI 가
          자동으로 발견 → 큐에 추가합니다.{" "}
          <strong>처리(Claude 분석)는 너님이 수동 트리거</strong> — 비용 통제 가능.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          전체 {accounts.length}개 · 활성 {active}개 · 비활성 {inactive}개
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-4">
        <h2 className="mb-2 text-sm font-bold text-slate-900">
          ➕ username 일괄 등록
        </h2>
        <AccountForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">
          등록된 계정 ({accounts.length}개)
        </h2>
        <AccountList accounts={accounts} />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 text-xs leading-relaxed text-slate-600 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-900">💡 운영 흐름</h2>
        <ul className="space-y-1.5 pl-4 list-disc">
          <li>
            <strong>매일 저녁 21:30</strong> Windows 작업 스케줄러가{" "}
            <code className="rounded bg-slate-100 px-1">py ingest.py --scan</code>{" "}
            자동 실행
          </li>
          <li>
            활성 계정 순회 (5초 sleep) → gallery-dl --simulate 로 최근 5개 게시물
            메타만 fetch (이미지 다운 X)
          </li>
          <li>
            ingest_queue 의 url unique 제약으로 이미 본 게시물은 자동 스킵 →
            <strong>신규만 todo 로 쌓임</strong>
          </li>
          <li>
            <strong>Claude 분석은 자동 안 함</strong> — 너님이{" "}
            <code className="rounded bg-slate-100 px-1">py ingest.py --pull</code>{" "}
            수동 실행해야 처리 시작 (비용 0원 유지)
          </li>
          <li>
            비활성 토글하면 스캔 대상에서 제외 (삭제 X, 추후 복구 가능)
          </li>
          <li>
            오류 (비공개·삭제·쿠키 만료) 발생한 계정은 ⚠ 메시지로 표시
          </li>
        </ul>
      </section>
    </main>
  );
}

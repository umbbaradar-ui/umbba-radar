// ============================================
// URL 일괄 등록 — /admin/bulk-ingest (Phase 1.5 자동화)
//
// 흐름:
//   1) 발견한 인스타·블로그 URL들을 텍스트박스에 줄바꿈으로 입력
//   2) "일괄 등록" 클릭 → 각 URL을 source_url로 draft 자동 생성
//   3) 외부 도구 1클릭 패널 동시 노출 (savefrom/iloveimg/gramfetchr)
//   4) /admin/queue에서 각 카드의 이미지·캡션·AI 분류 마무리
//
// 단일 카드 작성(/admin/new)과 분리한 이유: 발견·등록 vs 정리 작업 머리 분리.
// ============================================

import Link from "next/link";
import { BulkIngestForm } from "./BulkIngestForm";

export const dynamic = "force-dynamic";

export default function BulkIngestPage() {
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
          URL 일괄 등록
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          발견한 인스타·블로그 URL을 줄바꿈으로 한 번에 입력하세요. 각 URL이{" "}
          <strong>draft 카드</strong>로 생성됩니다.{" "}
          <Link
            href="/admin/queue"
            className="text-rose-600 underline hover:text-rose-700"
          >
            /admin/queue
          </Link>{" "}
          에서 이미지·캡션·AI 분류를 이어 진행하세요.
        </p>
      </header>

      <BulkIngestForm />

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 text-xs leading-relaxed text-slate-600 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-900">💡 사용 팁</h2>
        <ul className="space-y-1.5 pl-4 list-disc">
          <li>
            인스타 게시물 URL 형식:{" "}
            <code className="rounded bg-slate-100 px-1.5">
              https://www.instagram.com/p/...
            </code>
          </li>
          <li>
            <strong>중복 URL은 자동 스킵</strong>됩니다 (이미 등록된 URL은 결과에
            표시).
          </li>
          <li>
            등록된 카드는 모두 <strong>draft</strong> 상태로 시작. 큐에서 이미지
            업로드 + AI 자동 분류 → 검수 후 published.
          </li>
          <li>
            한 번에 100건 정도까지는 안전. 너무 많으면 작은 묶음으로 나눠
            진행하세요.
          </li>
        </ul>
      </section>
    </main>
  );
}

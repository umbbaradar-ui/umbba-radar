"use client";

// ============================================
// URL 일괄 등록 폼 — 텍스트박스 입력 + 결과 표시 + 외부 도구 1클릭
// ============================================

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  bulkIngestUrlsAction,
  type BulkIngestResult,
} from "@/modules/curation/actions";

const EXTERNAL_TOOLS = [
  {
    label: "📥 savefrom",
    sub: "(인스타 JPG 다운)",
    url: "https://ko.savefrom.net/137kq/download-from-instagram",
  },
  {
    label: "🔄 iloveimg",
    sub: "(HEIC·WEBP→JPG)",
    url: "https://www.iloveimg.com/ko/convert-to-jpg",
  },
  {
    label: "🎬 gramfetchr",
    sub: "(영상 썸네일)",
    url: "https://gramfetchr.com/ko/thumbnail-downloader",
  },
] as const;

export function BulkIngestForm() {
  const [rawText, setRawText] = useState("");
  const [autoExtract, setAutoExtract] = useState(true);
  const [result, setResult] = useState<BulkIngestResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!rawText.trim()) return;
    startTransition(async () => {
      const r = await bulkIngestUrlsAction(rawText, { autoExtract });
      setResult(r);
      if (r.created > 0 || r.extracted > 0) {
        setRawText("");
      }
    });
  }

  const urlCount = rawText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            URL 목록 (줄바꿈 또는 쉼표 구분)
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={pending}
            rows={10}
            placeholder={`https://www.instagram.com/p/DYuPnFWFN-i/\nhttps://www.instagram.com/p/...\nhttps://blog.naver.com/...`}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-rose-400 disabled:opacity-60"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            입력된 URL: <strong>{urlCount}개</strong>
          </p>
        </div>

        {/* 자동 분류 옵션 */}
        <label className="flex items-start gap-2 rounded-xl bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
          <input
            type="checkbox"
            checked={autoExtract}
            onChange={(e) => setAutoExtract(e.target.checked)}
            className="mt-0.5 h-4 w-4"
            disabled={pending}
          />
          <span>
            <strong>🤖 자동 AI 분류 시도</strong> (네이버 블로그·일반 URL은
            제목·캡션·시기·이미지까지 자동 채워짐)
            <br />
            <span className="text-amber-700/80">
              * Vercel timeout 회피로 한 번에 최대 <strong>5개만 자동 추출</strong>,
              나머지는 빈 draft. 인스타는 차단돼서 자동 분류 거의 실패 →
              단순 draft 생성. 큰 묶음은 5개씩 끊어서 반복 권장.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={pending || urlCount === 0}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {pending
              ? autoExtract
                ? "AI 분류 + 등록 중… (최대 30초)"
                : "등록 중…"
              : `${urlCount}개 ${autoExtract ? "자동 분류 + " : ""}일괄 등록`}
          </button>
          {urlCount > 100 && (
            <p className="text-xs text-amber-700">
              ⚠️ 100개 넘으면 처리 느려질 수 있어요. 작은 묶음으로 나누는 게
              안전.
            </p>
          )}
        </div>
      </form>

      {/* 결과 표시 */}
      {result && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-slate-900">처리 결과</h2>
          <div className="space-y-2 text-xs leading-relaxed text-slate-700">
            <p>
              총 입력: <strong>{result.total}개</strong>
              {result.extracted > 0 && (
                <>
                  {" "}· 🤖 AI 분류 완료:{" "}
                  <strong className="text-emerald-700">
                    {result.extracted}개
                  </strong>
                </>
              )}
              {" "}· 빈 draft:{" "}
              <strong className="text-slate-600">{result.created}개</strong>
              {" "}· 중복 스킵:{" "}
              <span className="text-amber-700">
                {result.duplicates.length}개
              </span>
              {" "}· 형식 오류:{" "}
              <span className="text-rose-600">{result.invalid.length}개</span>
            </p>

            {result.extractFailed.length > 0 && (
              <details className="rounded-lg bg-slate-50 px-3 py-2">
                <summary className="cursor-pointer font-semibold text-slate-600">
                  자동 분류 실패 ({result.extractFailed.length}개) — 단순 draft로
                  생성됨
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4 text-slate-500">
                  {result.extractFailed.map((u) => (
                    <li key={u} className="break-all">
                      · {u}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-slate-500">
                  대부분 인스타 차단. 큐에서 이미지 다운받아 수동 분류하세요.
                </p>
              </details>
            )}

            {result.duplicates.length > 0 && (
              <details className="rounded-lg bg-amber-50/60 px-3 py-2">
                <summary className="cursor-pointer font-semibold text-amber-800">
                  중복 스킵된 URL ({result.duplicates.length}개)
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4 text-amber-700">
                  {result.duplicates.map((u) => (
                    <li key={u} className="break-all">
                      · {u}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {result.invalid.length > 0 && (
              <details className="rounded-lg bg-rose-50/60 px-3 py-2">
                <summary className="cursor-pointer font-semibold text-rose-700">
                  형식 오류 URL ({result.invalid.length}개)
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4 text-rose-700">
                  {result.invalid.map((u) => (
                    <li key={u} className="break-all">
                      · {u}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-lg bg-rose-100 px-3 py-2 text-rose-800">
                ⚠️ 오류 발생:
                <ul className="mt-1 pl-4">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      <strong>{e.url}</strong>: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.created > 0 && (
              <div className="mt-3 flex gap-2">
                <Link
                  href="/admin/queue"
                  className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600"
                >
                  큐에서 이어 정리하기 →
                </Link>
                <Link
                  href="/admin"
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  관리자 홈
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 외부 다운로드 도구 — 항상 노출 (사용자가 URL 모으면서 활용) */}
      <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 text-xs">
        <h2 className="mb-1.5 text-sm font-bold text-amber-900">
          🛠 인스타 다운로드 도구 (새 탭으로 열기)
        </h2>
        <p className="mb-3 text-amber-700">
          큐에서 이미지 채울 때 사용. 위 URL 목록을 복사해서 새 탭에 붙여넣고
          이미지·썸네일 다운로드 → 큐 카드별 업로드.
        </p>
        <div className="flex flex-wrap gap-2">
          {EXTERNAL_TOOLS.map((t) => (
            <a
              key={t.url}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-white px-3 py-1.5 font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
            >
              {t.label} <span className="text-amber-600">{t.sub}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

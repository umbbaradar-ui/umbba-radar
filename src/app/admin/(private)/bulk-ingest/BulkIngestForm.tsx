"use client";

// ============================================
// URL 큐 등록 폼 — textarea 입력 → addUrlsAction
// ============================================

import { useRef, useState, useTransition } from "react";
import {
  addUrlsAction,
  type AddUrlsActionResult,
} from "@/modules/ingestion/queue/actions";

export function BulkIngestForm() {
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<AddUrlsActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!rawText.trim()) return;
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const r = await addUrlsAction(fd);
      setResult(r);
      if (r.ok && r.data.added > 0) {
        setRawText("");
      }
    });
  }

  const urlCount = rawText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <div className="space-y-4">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            URL 목록 (줄바꿈 또는 쉼표 구분 · 최대 200개)
          </label>
          <textarea
            name="urls"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={pending}
            rows={8}
            placeholder={`https://www.instagram.com/p/DYuPnFWFN-i/\nhttps://www.instagram.com/p/...\nhttps://www.instagram.com/reel/...`}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-rose-400 disabled:opacity-60"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            입력된 URL: <strong>{urlCount}개</strong>
            <span className="ml-2 text-slate-400">
              · 쿼리 파라미터(?img_index 등)는 자동 제거 후 등록
            </span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={pending || urlCount === 0}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? "큐 등록 중…" : `${urlCount}개 큐에 추가`}
          </button>
          {urlCount > 200 && (
            <p className="text-xs text-rose-700">
              ⚠️ 200개 초과. 작게 나눠서 등록해주세요.
            </p>
          )}
        </div>
      </form>

      {result && !result.ok && (
        <div className="rounded-lg bg-rose-100 px-3 py-2.5 text-xs text-rose-800">
          {result.error}
        </div>
      )}

      {result && result.ok && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-slate-900">큐 등록 결과</h3>
          <div className="space-y-1.5 text-xs leading-relaxed text-slate-700">
            <p>
              ✅ 신규 큐 등록:{" "}
              <strong className="text-emerald-700">{result.data.added}개</strong>
              {result.data.skipped_duplicate_in_queue > 0 && (
                <>
                  {" "}· 큐 중복:{" "}
                  <span className="text-amber-700">
                    {result.data.skipped_duplicate_in_queue}개
                  </span>
                </>
              )}
              {result.data.skipped_already_posted > 0 && (
                <>
                  {" "}· 이미 카드로 등록됨:{" "}
                  <span className="text-zinc-600">
                    {result.data.skipped_already_posted}개
                  </span>
                </>
              )}
              {result.data.invalid > 0 && (
                <>
                  {" "}· 형식 오류:{" "}
                  <span className="text-rose-700">{result.data.invalid}개</span>
                </>
              )}
            </p>

            {result.data.invalidUrls.length > 0 && (
              <details className="rounded-lg bg-rose-50/60 px-3 py-2">
                <summary className="cursor-pointer font-semibold text-rose-700">
                  형식 오류 URL ({result.data.invalidUrls.length}개)
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4 text-rose-700">
                  {result.data.invalidUrls.map((u, i) => (
                    <li key={i} className="break-all">· {u}</li>
                  ))}
                </ul>
              </details>
            )}

            <p className="pt-1 text-[11px] text-slate-500">
              💡 CLI가 다음 폴링(최대 1시간 후)에 자동으로 가져가 처리합니다.
              아래 큐 리스트에서 상태 추적 가능.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

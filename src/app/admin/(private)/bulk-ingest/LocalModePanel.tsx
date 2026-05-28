"use client";

// ============================================
// 로컬 분석 모드 패널 (A·C)
// - [Export todo JSON] = 큐 todo 항목 JSON 다운로드 (Claude Code 입력)
// - [Import results JSON] = Claude Code 가 만든 결과 업로드 (카드 자동 생성)
// 비용 0원 옵션. 기존 --pull 과 병행.
// ============================================

import { useRef, useState, useTransition } from "react";

interface ImportResult {
  ok: boolean;
  created?: number;
  skipped?: number;
  failed?: number;
  errors?: Array<{ queue_id: string; message: string }>;
  error?: string;
}

export function LocalModePanel({ todoCount }: { todoCount: number }) {
  const [pending, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    if (todoCount === 0) {
      alert("export 할 todo 항목이 없어요.");
      return;
    }
    // 새 탭에서 다운로드 (Content-Disposition 자동)
    window.location.href = "/api/admin/queue/export-todo";
  }

  function handleImportClick() {
    fileRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    startTransition(async () => {
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const items = payload.items ?? payload; // {items: [...]} 또는 [...] 둘 다 허용
        if (!Array.isArray(items)) {
          setImportResult({ ok: false, error: "JSON 형식 오류: items 배열 없음" });
          return;
        }
        const r = await fetch("/api/admin/queue/import-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const data = (await r.json()) as ImportResult;
        setImportResult(data);
      } catch (err) {
        setImportResult({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            🆓 로컬 분석 모드 (API 비용 0원)
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Claude Code 구독 안에서 분류·정리 → 결과만 업로드. API 호출 X.
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-500">
          export 대기: <strong className="text-slate-900">{todoCount}개</strong>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={pending || todoCount === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          ⬇ Export todo JSON ({todoCount})
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "업로드 중…" : "⬆ Import results JSON"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <details className="mt-3 text-[11px] text-slate-600">
        <summary className="cursor-pointer font-semibold">💡 사용법 (Claude Code)</summary>
        <ol className="mt-2 space-y-1 pl-4 list-decimal">
          <li>위 [Export] 클릭 → <code>todo-YYYYMMDD.json</code> 다운로드</li>
          <li>
            Claude Code 에서:{" "}
            <code className="rounded bg-slate-100 px-1.5">
              todo-2026-05-28.json 의 항목들 RULES.md 보고 분류해줘
            </code>
          </li>
          <li>Claude Code 가 <code>results.json</code> 만들면 [Import] 로 업로드</li>
          <li>각 항목이 ③ 카드 승인 큐에 pending 으로 자동 진입</li>
        </ol>
        <p className="mt-2 text-amber-700">
          RULES.md 는 <code>tools/umbba-cli/RULES.md</code> 에 있어요. 운영 중 다듬어가세요.
        </p>
      </details>

      {importResult && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            importResult.ok
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {importResult.ok ? (
            <>
              ✅ 카드 생성:{" "}
              <strong>{importResult.created ?? 0}개</strong>
              {(importResult.skipped ?? 0) > 0 && (
                <> · 스킵: {importResult.skipped}개 (노이즈·중복)</>
              )}
              {(importResult.failed ?? 0) > 0 && (
                <> · 실패: {importResult.failed}개</>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer">
                    실패 항목 ({importResult.errors.length}개)
                  </summary>
                  <ul className="mt-1 pl-4">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="font-mono">
                        {e.queue_id.slice(0, 8)}…: {e.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <>⚠ {importResult.error}</>
          )}
        </div>
      )}
    </section>
  );
}

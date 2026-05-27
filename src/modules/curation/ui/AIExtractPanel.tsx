"use client";

// ============================================
// AI 자동 추출 패널 — 폼 상단 배치
// URL 입력 → Claude Vision 으로 카드 메타데이터 추출 → 폼 자동 입력
// (스크린샷 업로드 모드는 글 짤림으로 신뢰성 낮아서 제거. URL → 본 운영은 CLI)
// ============================================

import { useState, useTransition } from "react";
import type { AIExtractResponse } from "../ai-extract-actions";
import type { VisionExtractResult } from "@/modules/ingestion/vision-extractor";

interface Props {
  extractFromUrl: (url: string) => Promise<AIExtractResponse>;
  onExtracted: (data: VisionExtractResult, thumbnailUrl: string | null) => void;
}

export function AIExtractPanel({ extractFromUrl, onExtracted }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleUrlExtract = () => {
    setError(null);
    if (!url.trim()) {
      setError("URL을 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await extractFromUrl(url.trim());
      if (result.ok) {
        onExtracted(result.data, result.thumbnail_url);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <section className="space-y-3 rounded-2xl border-2 border-dashed border-rose-200 bg-gradient-to-br from-rose-50/60 to-amber-50/40 p-5">
      <header>
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <span aria-hidden>🤖</span>
          <span>AI 자동 추출</span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
            BETA
          </span>
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          URL 1개씩 단발 추출 (정상 동작은 비인스타 OG 한정). 인스타 다량은 CLI 운영을 권장
        </p>
      </header>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={pending}
            placeholder="https://www.instagram.com/p/... 또는 OG 메타 있는 일반 URL"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleUrlExtract();
              }
            }}
          />
          <button
            type="button"
            onClick={handleUrlExtract}
            disabled={pending}
            className="shrink-0 rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-60"
          >
            {pending ? "분석 중…" : "추출"}
          </button>
        </div>

        {/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)/i.test(url) && (
          <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
            <p className="font-semibold">
              💡 인스타 URL은 서버 IP 차단으로 거의 항상 막혀요
            </p>
            <p className="mt-1 text-amber-700">
              인스타는 <strong>로컬 CLI (tools/umbba-cli)</strong> 로 처리하세요.
              urls.txt 에 URL 모아두고 <code className="rounded bg-amber-100 px-1">py ingest.py urls.txt</code> →
              본인 PC IP + 쿠키로 다운받아 Vercel 에 직접 POST → Claude 분류 → 자동 등록.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-rose-100 px-3 py-2.5 text-xs text-rose-800 whitespace-pre-line leading-relaxed">
          {error}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-slate-400">
        💡 OG 메타 있는 일반 사이트 URL은 정상 추출돼요. 추출 결과는 폼에 자동 입력되며 검토·수정 후 발행하세요.
      </p>
    </section>
  );
}

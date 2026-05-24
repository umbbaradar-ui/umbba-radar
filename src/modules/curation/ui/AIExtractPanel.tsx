"use client";

// ============================================
// AI 자동 추출 패널 — 폼 상단 배치
// URL 또는 이미지 입력 → Gemini Vision으로 카드 메타데이터 추출 → 폼 자동 입력
// ============================================

import { useRef, useState, useTransition } from "react";
import type { AIExtractResponse } from "../ai-extract-actions";
import type { VisionExtractResult } from "@/modules/ingestion/vision-extractor";

interface Props {
  extractFromImage: (formData: FormData) => Promise<AIExtractResponse>;
  extractFromUrl: (url: string) => Promise<AIExtractResponse>;
  onExtracted: (data: VisionExtractResult, thumbnailUrl: string | null) => void;
}

type Mode = "url" | "image";

export function AIExtractPanel({
  extractFromImage,
  extractFromUrl,
  onExtracted,
}: Props) {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageExtract = (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("10MB 이하 이미지만 가능해요.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 가능해요.");
      return;
    }
    const fd = new FormData();
    fd.append("image", file);
    startTransition(async () => {
      const result = await extractFromImage(fd);
      if (result.ok) {
        onExtracted(result.data, result.thumbnail_url);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <section className="space-y-3 rounded-2xl border-2 border-dashed border-rose-200 bg-gradient-to-br from-rose-50/60 to-amber-50/40 p-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <span aria-hidden>🤖</span>
            <span>AI 자동 추출</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              BETA
            </span>
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            인스타 URL 또는 스크린샷 한 장이면 제목·브랜드·요약·태그를 자동으로 채워요
          </p>
        </div>
      </header>

      {/* 모드 토글 */}
      <div className="flex gap-1 rounded-lg bg-white p-1">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "url"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          🔗 URL로 추출
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "image"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📷 스크린샷으로 추출
        </button>
      </div>

      {mode === "url" ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={pending}
            placeholder="https://www.instagram.com/p/..."
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
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageExtract(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-xs text-slate-600 hover:border-rose-300 disabled:opacity-60"
          >
            <span className="text-2xl">📷</span>
            <span className="font-medium">
              {pending ? "분석 중…" : "이미지 선택 (HEIC·PNG·JPG·WEBP)"}
            </span>
            <span className="text-[10px] text-slate-400">
              인스타 스크린샷 그대로 OK · 10MB 이하
            </span>
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-100 px-3 py-2.5 text-xs text-rose-800 whitespace-pre-line leading-relaxed">
          {error}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-slate-400">
        💡 <strong>인스타 URL은 거의 차단됨</strong> → 스크린샷 업로드를 기본으로 사용하세요. 추출 결과는 자동 입력되며 검토·수정 후 발행. HEIC·JPG·PNG·WEBP 모두 지원 (변환 불필요).
      </p>
    </section>
  );
}

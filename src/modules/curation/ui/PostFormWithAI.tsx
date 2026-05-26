"use client";

// ============================================
// AI 자동 추출 + PostForm 통합 래퍼
// AI 추출 결과를 받아 PostForm의 defaults를 갈아끼우고 key prop으로 remount
// ============================================

import { useState } from "react";
import type { Post } from "@/shared/types/post";
import { AIExtractPanel } from "./AIExtractPanel";
import { PostForm, type PostFormDefaults } from "./PostForm";
import type { AIExtractResponse } from "../ai-extract-actions";
import type { VisionExtractResult } from "@/modules/ingestion/vision-extractor";

interface Props {
  /** 수정 모드 — 기존 카드 prefill (AI 추출 결과가 들어오면 그게 우선) */
  post?: Post;
  action: (formData: FormData) => Promise<void> | void;
  extractFromImage: (formData: FormData) => Promise<AIExtractResponse>;
  extractFromUrl: (url: string) => Promise<AIExtractResponse>;
  submitLabel: string;
  errorMessage?: string | null;
}

export function PostFormWithAI({
  post,
  action,
  extractFromImage,
  extractFromUrl,
  submitLabel,
  errorMessage,
}: Props) {
  const [defaults, setDefaults] = useState<PostFormDefaults | undefined>(
    undefined
  );
  const [version, setVersion] = useState(0);
  const [extractedAt, setExtractedAt] = useState<string | null>(null);

  const handleExtracted = (
    data: VisionExtractResult,
    thumbnailUrl: string | null
  ) => {
    // AI 결과를 PostFormDefaults 형태로 변환
    const newDefaults: PostFormDefaults = {
      kind: data.kind ?? "recruiting",
      title: data.title,
      brand_name: data.brand_name,
      thumbnail_url: thumbnailUrl,
      body: data.body,
      deadline: data.deadline,
      stage_categories: data.stage_categories ?? [],
      type_tags: data.type_tags ?? [],
      topic: data.topic ?? "parenting",
      // 추출 직후엔 일단 pending(승인대기)로 두고 관리자가 검토 후 published로 변경 권장
      status: "pending",
    };
    setDefaults(newDefaults);
    setVersion((v) => v + 1); // key 변경 → 폼 remount → 새 defaults 반영
    setExtractedAt(
      `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 신뢰도 ${(data.confidence * 100).toFixed(0)}%`
    );
  };

  return (
    <div className="space-y-5">
      <AIExtractPanel
        extractFromImage={extractFromImage}
        extractFromUrl={extractFromUrl}
        onExtracted={handleExtracted}
      />

      {extractedAt && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          <span aria-hidden>✨</span>
          <span>
            AI 추출 완료 ({extractedAt}). 아래 폼의 모든 필드를 검토·수정 후 저장하세요.
          </span>
        </div>
      )}

      <PostForm
        key={version}
        post={post}
        action={action}
        defaults={defaults}
        submitLabel={submitLabel}
        errorMessage={errorMessage}
      />
    </div>
  );
}

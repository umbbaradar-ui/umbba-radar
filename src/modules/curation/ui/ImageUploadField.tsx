"use client";

// ============================================
// 이미지 업로드 필드 — 클릭·드래그·붙여넣기 지원
// - 파일 선택 (input[type=file])
// - 드래그&드롭
// - 클립보드 붙여넣기 (스샷 그대로 Ctrl+V)
// - URL 직접 붙여넣기 (Unsplash·인스타 hotlink 등)
// ============================================

import { useEffect, useRef, useState, useTransition } from "react";
import { uploadImageAction } from "../actions";

interface Props {
  name: string;
  defaultValue?: string | null;
  /** 클립보드 전역 paste 활성 여부. 폼이 여러 개면 false 권장 */
  enableGlobalPaste?: boolean;
}

export function ImageUploadField({
  name,
  defaultValue,
  enableGlobalPaste = true,
}: Props) {
  const [url, setUrl] = useState<string>(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 가능해요");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("5MB 이하만 가능해요");
      return;
    }
    const fd = new FormData();
    fd.append("image", file);
    startTransition(async () => {
      const result = await uploadImageAction(fd);
      if (result.ok) {
        setUrl(result.url);
      } else {
        setError(result.error);
      }
    });
  };

  // 클립보드 paste (Ctrl+V로 스샷 직접 붙여넣기)
  useEffect(() => {
    if (!enableGlobalPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            handleFile(f);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableGlobalPaste]);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />

      <div
        className={`relative rounded-xl border-2 border-dashed transition ${
          dragOver
            ? "border-rose-400 bg-rose-50"
            : "border-slate-300 bg-slate-50"
        } ${isPending ? "opacity-60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        {url ? (
          <div className="flex items-center gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="미리보기"
              className="h-20 w-20 rounded-lg object-cover"
            />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs text-slate-600">{url}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setError(null);
              }}
              className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
            >
              제거
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 px-4 py-6 text-xs text-slate-600"
          >
            <span className="text-lg">📷</span>
            <span className="font-medium">
              {isPending ? "업로드 중…" : "이미지 업로드"}
            </span>
            <span className="text-[11px] text-slate-400">
              클릭 · 드래그&드롭 · Ctrl+V로 스샷 붙여넣기
            </span>
            <span className="mt-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              💡 1:1 정사각형 이미지 권장 (인스타 첫 사진 그대로 OK)
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400">또는 URL 직접 입력:</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
        />
      </div>
    </div>
  );
}

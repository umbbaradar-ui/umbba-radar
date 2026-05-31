"use client";

// ============================================
// 관리자 카드 관리 필터바
// URL searchParams 기반 → 새로고침·즐겨찾기 안전, 서버 컴포넌트와 호환
// ============================================

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  ACTIVE_STAGE_CATEGORIES,
  ACTIVE_TYPE_TAGS,
  STAGE_LABELS,
  TYPE_LABELS,
} from "@/shared/types/post";

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "published", label: "발행" },
  { value: "pending", label: "승인대기" },
  { value: "draft", label: "초안" },
] as const;

const SORT_OPTIONS = [
  { value: "deadline_asc", label: "마감 임박 ↑" },
  { value: "deadline_desc", label: "마감 늦은 ↓" },
  { value: "updated_desc", label: "최근 수정" },
  { value: "created_desc", label: "최신 등록" },
  { value: "created_asc", label: "오래된 등록" },
] as const;

export type AdminTab = "active" | "expired";

interface Props {
  tab: AdminTab;
  status: string;
  stage: string;
  type: string;
  sort: string;
  counts: {
    active: number;
    expired: number;
  };
  /** 있으면 URL 이동 없이 즉시(클라이언트 상태) 변경. 없으면 기존 URL 방식. */
  onChange?: (key: string, value: string | null) => void;
}

export function AdminFilterBar({
  tab,
  status,
  stage,
  type,
  sort,
  counts,
  onChange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      if (onChange) {
        onChange(key, value);
        return;
      }
      const sp = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") sp.delete(key);
      else sp.set(key, value);
      router.push(`${pathname}?${sp.toString()}`);
    },
    [onChange, pathname, router, searchParams]
  );

  return (
    <div className="space-y-3">
      {/* 탭: 활성 / 마감 */}
      <div className="flex gap-2 border-b border-slate-200">
        <TabButton
          active={tab === "active"}
          onClick={() => setParam("tab", null)}
        >
          활성 ({counts.active})
        </TabButton>
        <TabButton
          active={tab === "expired"}
          onClick={() => setParam("tab", "expired")}
        >
          마감 ({counts.expired})
        </TabButton>
      </div>

      {/* 활성 탭에서만 상태 필터 노출 */}
      {tab === "active" && (
        <FilterRow label="상태">
          {STATUS_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={status === opt.value}
              onClick={() => setParam("status", opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </FilterRow>
      )}

      <FilterRow label="시기">
        <Chip active={stage === "all"} onClick={() => setParam("stage", "all")}>
          전체
        </Chip>
        {ACTIVE_STAGE_CATEGORIES.map((s) => (
          <Chip
            key={s}
            active={stage === s}
            onClick={() => setParam("stage", s)}
          >
            {STAGE_LABELS[s]}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="유형">
        <Chip active={type === "all"} onClick={() => setParam("type", "all")}>
          전체
        </Chip>
        {ACTIVE_TYPE_TAGS.map((t) => (
          <Chip
            key={t}
            active={type === t}
            onClick={() => setParam("type", t)}
          >
            {TYPE_LABELS[t]}
          </Chip>
        ))}
      </FilterRow>

      <FilterRow label="정렬">
        {SORT_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            active={sort === opt.value}
            onClick={() => setParam("sort", opt.value)}
          >
            {opt.label}
          </Chip>
        ))}
      </FilterRow>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-400 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-10 shrink-0 text-[11px] font-semibold text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

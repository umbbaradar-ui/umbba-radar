"use client";

// ============================================
// 카드 생성·수정 공용 폼
// "use client" — AI 자동 추출 결과를 받아 defaultValue를 동적으로 갈아끼우기 위해
// 부모(PostFormWithAI)가 key prop으로 remount 시키면 새 defaults 반영됨
// ============================================

import { useState } from "react";
import type { Post } from "@/shared/types/post";
import {
  STAGE_LABELS,
  ACTIVE_STAGE_CATEGORIES,
  TYPE_LABELS,
  ACTIVE_TYPE_TAGS,
  ITEM_CATEGORY_LABELS,
  ACTIVE_ITEM_CATEGORIES,
  TOPIC_LABELS,
  ACTIVE_TOPIC_CATEGORIES,
} from "@/shared/types/post";
import { ImageUploadField } from "./ImageUploadField";

/** 마감 미정 카드의 자동 종료 기간 선택지 (actions.ts와 동기화) */
const UNKNOWN_DAYS_OPTIONS = [1, 3, 7] as const;
const DEFAULT_UNKNOWN_DAYS = 7;

export interface PostFormDefaults {
  kind?: string;
  title?: string;
  brand_name?: string | null;
  thumbnail_url?: string | null;
  source_url?: string;
  body?: string | null;
  search_keywords?: string | null;
  deadline?: string | null;
  deadline_unknown?: boolean;
  reviewer_handle?: string | null;
  stage_categories?: string[];
  type_tags?: string[];
  item_categories?: string[];
  topic?: string;
  status?: string;
  is_sponsored?: boolean;
}

interface Props {
  post?: Post; // 수정 시 prefill
  defaults?: PostFormDefaults; // AI 추출 결과 등 동적 prefill (post보다 우선)
  action: (formData: FormData) => Promise<void> | void;
  /** 있으면 "발행 저장"(수정 + 즉시 발행) 초록 버튼 노출 — status를 published로 강제 */
  publishAction?: (formData: FormData) => Promise<void> | void;
  submitLabel: string;
  errorMessage?: string | null;
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // KST 기준 YYYY-MM-DDTHH:mm 으로 변환 (서버·클라이언트 timezone 무관)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

export function PostForm({ post, defaults, action, publishAction, submitLabel, errorMessage }: Props) {
  // defaults가 있으면 post보다 우선 (AI 추출 결과 등 동적 prefill)
  const v = {
    kind: defaults?.kind ?? post?.kind ?? "recruiting",
    title: defaults?.title ?? post?.title ?? "",
    brand_name: defaults?.brand_name ?? post?.brand_name ?? "",
    thumbnail_url: defaults?.thumbnail_url ?? post?.thumbnail_url ?? null,
    source_url: defaults?.source_url ?? post?.source_url ?? "",
    body: defaults?.body ?? post?.body ?? "",
    search_keywords:
      defaults?.search_keywords ?? post?.search_keywords ?? "",
    deadline: toLocalDatetimeInput(
      defaults?.deadline ?? post?.deadline ?? null
    ),
    deadline_unknown:
      defaults?.deadline_unknown ?? post?.deadline_unknown ?? false,
    reviewer_handle: defaults?.reviewer_handle ?? post?.reviewer_handle ?? "",
    stage_categories:
      defaults?.stage_categories ?? post?.stage_categories ?? [],
    type_tags: defaults?.type_tags ?? post?.type_tags ?? [],
    item_categories: defaults?.item_categories ?? post?.item_categories ?? [],
    topic: defaults?.topic ?? post?.topic ?? "parenting",
    status: defaults?.status ?? post?.status ?? "draft",
    is_sponsored: defaults?.is_sponsored ?? post?.is_sponsored ?? false,
  };

  // 마감 미정 토글 — 체크 시 datetime input 비활성화 + 노출 기간 라디오 노출
  const [deadlineUnknown, setDeadlineUnknown] = useState(v.deadline_unknown);
  const [unknownDays, setUnknownDays] = useState<number>(DEFAULT_UNKNOWN_DAYS);

  return (
    <form action={action} className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      <Section title="기본">
        <Field label="종류 (kind)">
          <select
            name="kind"
            // 기존 'review' 카드는 자동으로 'recruiting'으로 보여줌 (review 옵션 제거)
            defaultValue={v.kind === "review" ? "recruiting" : v.kind}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="recruiting">모집중 (recruiting)</option>
            <option value="group_buy">공구 (group_buy)</option>
            <option value="sponsored_ad">광고 (sponsored_ad)</option>
          </select>
        </Field>

        <Field label="제목 (필수)">
          <input
            type="text"
            name="title"
            required
            defaultValue={v.title}
            placeholder="예: ○○ 분유 무료 샘플 신청"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="브랜드명">
          <input
            type="text"
            name="brand_name"
            defaultValue={v.brand_name ?? ""}
            placeholder="예: 맘앤베베"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="이미지·링크">
        <Field label="썸네일 이미지">
          <ImageUploadField
            name="thumbnail_url"
            defaultValue={v.thumbnail_url}
          />
        </Field>

        <Field label="원문 URL (필수)">
          <input
            type="url"
            name="source_url"
            required
            defaultValue={v.source_url}
            placeholder="https://instagram.com/p/..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="내용">
        <Field label="신청 방법 / 후기 요약">
          <textarea
            name="body"
            rows={14}
            defaultValue={v.body ?? ""}
            placeholder="예: 인스타 댓글 + 친구 태그 → 30명 추첨"
            className="block w-full min-h-[320px] resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            CLI 자동 등록 시 인스타 캡션이 그대로 들어와요 (최대 2000자). 모서리 드래그로 더 늘릴 수 있어요.
          </p>
        </Field>

        <Field label="검색 키워드 (동의어·유사어)">
          <textarea
            name="search_keywords"
            rows={2}
            defaultValue={v.search_keywords ?? ""}
            placeholder="기저귀, 팬티, 기저귀팬티"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            카드에 안 적힌 비슷한 단어도 검색에 잡히게 — <strong>콤마(,)로 구분</strong>해서 입력.
            <br />
            예: 팬티·기저귀 / 분유·이유식·수유 / 유모차·뒤집기카 등.
            사용자에게 노출되지는 않아요.
          </p>
        </Field>

        <Field label="마감일">
          <input
            type="datetime-local"
            name="deadline"
            defaultValue={v.deadline}
            disabled={deadlineUnknown}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          />
          {/* 마감 미정 토글 — 체크 시 등록일 +N일을 자동으로 deadline에 저장
              (사용자에게는 "추정 마감" 라벨로 표시, 푸시 알림은 제외) */}
          <div className="mt-2 rounded-lg bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="deadline_unknown"
                checked={deadlineUnknown}
                onChange={(e) => setDeadlineUnknown(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <strong>마감일 미정</strong> (체크 시 등록일 +N일 후 자동 종료)
                <br />
                <span className="text-amber-700/80">
                  * 정확한 마감은 본문에 적어주세요. 푸시 알림은 발송되지 않아요.
                </span>
              </span>
            </label>
            {/* 노출 기간 라디오 — 체크박스 활성 시에만 노출 */}
            {deadlineUnknown && (
              <div className="mt-2 flex items-center gap-3 border-t border-amber-200/60 pt-2">
                <span className="font-medium">노출 기간:</span>
                {UNKNOWN_DAYS_OPTIONS.map((d) => (
                  <label
                    key={d}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 has-[:checked]:bg-amber-200/60 has-[:checked]:font-bold"
                  >
                    <input
                      type="radio"
                      name="unknown_days"
                      value={d}
                      checked={unknownDays === d}
                      onChange={() => setUnknownDays(d)}
                      className="h-3.5 w-3.5"
                    />
                    {d}일
                  </label>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="후기 작성자 핸들 (review일 때만)">
          <input
            type="text"
            name="reviewer_handle"
            defaultValue={v.reviewer_handle ?? ""}
            placeholder="@nickname"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="주제">
        <div className="flex gap-2">
          {ACTIVE_TOPIC_CATEGORIES.map((k) => (
            <label
              key={k}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 has-[:checked]:border-rose-300 has-[:checked]:bg-rose-50 has-[:checked]:font-bold"
            >
              <input
                type="radio"
                name="topic"
                value={k}
                defaultChecked={v.topic === k}
                className="h-4 w-4"
              />
              {TOPIC_LABELS[k]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="시기 카테고리">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIVE_STAGE_CATEGORIES.map((k) => (
            <Checkbox
              key={k}
              name="stage_categories"
              value={k}
              label={STAGE_LABELS[k]}
              defaultChecked={v.stage_categories.includes(k)}
            />
          ))}
        </div>
      </Section>

      <Section title="유형 태그">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIVE_TYPE_TAGS.map((k) => (
            <Checkbox
              key={k}
              name="type_tags"
              value={k}
              label={TYPE_LABELS[k]}
              defaultChecked={v.type_tags.includes(k)}
            />
          ))}
        </div>
      </Section>

      <Section title="품목 카테고리 (보통 1개, 최대 2개)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIVE_ITEM_CATEGORIES.map((k) => (
            <Checkbox
              key={k}
              name="item_categories"
              value={k}
              label={ITEM_CATEGORY_LABELS[k]}
              defaultChecked={v.item_categories.includes(k)}
            />
          ))}
        </div>
      </Section>

      <Section title="발행">
        <Field label="상태">
          <select
            name="status"
            defaultValue={v.status}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="draft">초안 (draft)</option>
            <option value="pending">승인대기 (pending)</option>
            <option value="published">발행 (published)</option>
            <option value="expired">마감 (expired)</option>
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_sponsored"
            defaultChecked={v.is_sponsored}
            className="h-4 w-4 rounded border-slate-300"
          />
          스폰서드 (상단 고정 광고 후보)
        </label>
      </Section>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <a
          href="/admin"
          className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          취소
        </a>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
        {publishAction && (
          <button
            type="submit"
            formAction={publishAction}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            ✓ 발행 저장
          </button>
        )}
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-rose-300 has-[:checked]:bg-rose-50">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

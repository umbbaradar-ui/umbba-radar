// ============================================
// 카드 생성·수정 공용 폼
// Server Component — 'use client' 없음
// ============================================

import type { Post } from "@/shared/types/post";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";
import { ImageUploadField } from "./ImageUploadField";

interface Props {
  post?: Post; // 수정 시 prefill
  action: (formData: FormData) => Promise<void> | void;
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

export function PostForm({ post, action, submitLabel, errorMessage }: Props) {
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
            defaultValue={post?.kind ?? "recruiting"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="recruiting">모집중 (recruiting)</option>
            <option value="review">후기 (review)</option>
            <option value="group_buy">공구 (group_buy)</option>
            <option value="sponsored_ad">광고 (sponsored_ad)</option>
          </select>
        </Field>

        <Field label="제목 (필수)">
          <input
            type="text"
            name="title"
            required
            defaultValue={post?.title ?? ""}
            placeholder="예: ○○ 분유 무료 샘플 신청"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="브랜드명">
          <input
            type="text"
            name="brand_name"
            defaultValue={post?.brand_name ?? ""}
            placeholder="예: 맘앤베베"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="이미지·링크">
        <Field label="썸네일 이미지">
          <ImageUploadField
            name="thumbnail_url"
            defaultValue={post?.thumbnail_url}
          />
        </Field>

        <Field label="원문 URL (필수)">
          <input
            type="url"
            name="source_url"
            required
            defaultValue={post?.source_url ?? ""}
            placeholder="https://instagram.com/p/..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="내용">
        <Field label="신청 방법 / 후기 요약">
          <textarea
            name="body"
            rows={4}
            defaultValue={post?.body ?? ""}
            placeholder="예: 인스타 댓글 + 친구 태그 → 30명 추첨"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="마감일">
          <input
            type="datetime-local"
            name="deadline"
            defaultValue={toLocalDatetimeInput(post?.deadline ?? null)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="후기 작성자 핸들 (review일 때만)">
          <input
            type="text"
            name="reviewer_handle"
            defaultValue={post?.reviewer_handle ?? ""}
            placeholder="@nickname"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="시기 카테고리">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <Checkbox
              key={k}
              name="stage_categories"
              value={k}
              label={v}
              defaultChecked={post?.stage_categories.includes(k as never)}
            />
          ))}
        </div>
      </Section>

      <Section title="유형 태그">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <Checkbox
              key={k}
              name="type_tags"
              value={k}
              label={v}
              defaultChecked={post?.type_tags.includes(k as never)}
            />
          ))}
        </div>
      </Section>

      <Section title="발행">
        <Field label="상태">
          <select
            name="status"
            defaultValue={post?.status ?? "draft"}
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
            defaultChecked={post?.is_sponsored}
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

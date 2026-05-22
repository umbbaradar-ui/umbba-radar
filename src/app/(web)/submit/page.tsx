// ============================================
// 사용자 제보 폼 — /submit
// 공개 페이지 (인증 불필요)
// 제출 시 status='pending', source_type='submission' 강제
// ============================================

import { submitPostAction } from "@/modules/curation/actions";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SubmitPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const errorMessage =
    error === "required" ? "원문 URL과 제목은 필수예요." : null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          혜택 제보하기
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          좋은 협찬·체험단·후기를 보셨다면 알려주세요. 검토 후 다른 부모님들과
          공유돼요.
        </p>
      </header>

      <form action={submitPostAction} className="space-y-5">
        {errorMessage && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        <Section title="기본">
          <Field label="원문 URL (필수)" required>
            <input
              type="url"
              name="source_url"
              required
              placeholder="https://instagram.com/p/... 또는 블로그 링크"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
          </Field>

          <Field label="제목 (필수)" required>
            <input
              type="text"
              name="title"
              required
              placeholder="예: ○○ 분유 무료 샘플 신청"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
          </Field>

          <Field label="브랜드명">
            <input
              type="text"
              name="brand_name"
              placeholder="예: ○○분유"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
          </Field>

          <Field label="썸네일 이미지 URL">
            <input
              type="url"
              name="thumbnail_url"
              placeholder="이미지 직링크 (선택)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
          </Field>
        </Section>

        <Section title="설명">
          <Field label="한 줄 요약 / 신청 방법">
            <textarea
              name="body"
              rows={3}
              placeholder="예: 인스타 댓글 + 친구 태그 → 무료 샘플 발송"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
          </Field>

          <Field label="마감일">
            <input
              type="datetime-local"
              name="deadline"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
          </Field>
        </Section>

        <Section title="종류">
          <Field label="컨텐츠 종류">
            <select
              name="kind"
              defaultValue="recruiting"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="recruiting">모집중</option>
              <option value="review">후기</option>
              <option value="group_buy">공구</option>
            </select>
          </Field>
        </Section>

        <Section title="시기 (다중 선택 가능)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <Checkbox key={k} name="stage_categories" value={k} label={v} />
            ))}
          </div>
        </Section>

        <Section title="유형 (다중 선택 가능)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <Checkbox key={k} name="type_tags" value={k} label={v} />
            ))}
          </div>
        </Section>

        <Section title="제보자 (선택)">
          <Field label="닉네임 — 채택 시 표기됩니다">
            <input
              type="text"
              name="submitter_handle"
              maxLength={30}
              placeholder="예: 첫째맘 또는 @nickname"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              비워두시면 익명 제보로 처리됩니다
            </p>
          </Field>
        </Section>

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          제보 제출
        </button>

        <p className="text-center text-[11px] text-slate-400">
          제출된 정보는 관리자 검토 후 공개됩니다. 검토 기준에 맞지 않으면
          반려될 수 있어요.
        </p>
      </form>
    </main>
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
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 has-[:checked]:border-rose-300 has-[:checked]:bg-rose-50">
      <input type="checkbox" name={name} value={value} className="h-4 w-4" />
      {label}
    </label>
  );
}

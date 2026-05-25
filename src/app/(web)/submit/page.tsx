// ============================================
// 사용자 제보 폼 — /submit
// 간단함이 핵심: URL + 한 줄 설명 + (선택)닉네임
// 카테고리·시기·유형 등은 관리자가 큐에서 정리. 사용자에게 부담 X
//
// share_target 연동: manifest.ts에서 share_target.action="/submit"으로 등록.
// 다른 앱(인스타·카톡)에서 "공유 → 엄빠레이더" 선택 시 다음 쿼리로 도착:
//   /submit?shared_url=...&shared_title=...&shared_text=...
// → source_url과 description을 자동 prefill
// ============================================

import { submitPostAction } from "@/modules/curation/actions";
import { getCurrentUser } from "@/modules/user/service";
import { AdSlot } from "@/modules/advertising/ui/AdSlot";

interface PageProps {
  searchParams: Promise<{
    error?: string;
    /** share_target에서 전달된 URL (인스타 게시물 링크 등) */
    shared_url?: string;
    /** share_target에서 전달된 타이틀 (앱마다 다름, 보통 비어있음) */
    shared_title?: string;
    /** share_target에서 전달된 본문 (인스타 캡션, 메시지 본문 등) */
    shared_text?: string;
  }>;
}

/**
 * shared_text/title이 URL을 포함하면 거기서 첫 URL 추출.
 * 일부 앱은 url 필드 없이 text에 URL 박아 보냄.
 */
function extractFirstUrl(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export default async function SubmitPage({ searchParams }: PageProps) {
  const { error, shared_url, shared_title, shared_text } = await searchParams;
  const user = await getCurrentUser();

  const errorMessage =
    error === "required"
      ? "원문 URL과 한 줄 설명을 입력해주세요."
      : error === "invalid_url"
        ? "URL 형식이 올바르지 않아요."
        : null;

  // share_target prefill — 우선순위: shared_url > shared_text 안의 첫 URL
  const prefilledUrl = shared_url ?? extractFirstUrl(shared_text) ?? "";
  // 타이틀 + 본문 합쳐서 description prefill (200자 컷)
  // shared_text 안에 URL이 있으면 그건 제외 (이미 source_url로 사용)
  const descriptionParts = [shared_title, shared_text]
    .filter((s): s is string => Boolean(s))
    .map((s) =>
      prefilledUrl ? s.replace(prefilledUrl, "").trim() : s.trim()
    )
    .filter(Boolean);
  const prefilledDescription = descriptionParts.join(" — ").slice(0, 200);
  const isShared = Boolean(prefilledUrl || prefilledDescription);

  return (
    <main className="mx-auto max-w-xl px-5 py-6">
      <AdSlot id="submit_top" />

      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          이런 거 봤어요!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          좋은 협찬·체험단·후기를 발견하셨다면 알려주세요.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          가볍게 던져만 주시면 나머지는 저희가 정리합니다.
        </p>
      </header>

      <form
        action={submitPostAction}
        className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
      >
        {errorMessage && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        {isShared && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            ✨ 공유받은 내용을 자동으로 채웠어요. 확인 후 수정하셔도 돼요.
          </div>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-900">
            원문 링크 <span className="text-rose-500">*</span>
          </span>
          <input
            type="url"
            name="source_url"
            required
            defaultValue={prefilledUrl}
            placeholder="https://instagram.com/p/... 또는 블로그 링크"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
          />
          <span className="block text-[11px] text-slate-400">
            인스타·블로그·카페 등 원본 페이지 주소
          </span>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-900">
            한 줄 설명 <span className="text-rose-500">*</span>
          </span>
          <textarea
            name="description"
            required
            rows={3}
            maxLength={200}
            defaultValue={prefilledDescription}
            placeholder="예: ○○ 분유 무료 샘플 신청 이벤트, 마감 5월 30일"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
          />
          <span className="block text-[11px] text-slate-400">
            어떤 이벤트인지 짧게만 알려주세요. 분류는 저희가 합니다.
          </span>
        </label>

        {/* 로그인 / 비로그인 분기 */}
        {user ? (
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-600">
              <span className="font-bold text-slate-900">
                {user.name ?? user.email ?? "익명"}
              </span>{" "}
              으로 제보됩니다
            </p>
          </div>
        ) : (
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-900">
              닉네임{" "}
              <span className="text-[11px] font-normal text-slate-400">
                (선택)
              </span>
            </span>
            <input
              type="text"
              name="submitter_handle"
              maxLength={30}
              placeholder="예: 첫째맘 (비워두면 익명)"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
            <span className="block text-[11px] text-slate-400">
              채택 시 카드에 표시됩니다
            </span>
          </label>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.99]"
        >
          제보하기
        </button>

        <p className="text-center text-[11px] text-slate-400">
          관리자가 검토한 후 공개됩니다. 보통 1~2일 안에 반영돼요.
        </p>
      </form>
    </main>
  );
}

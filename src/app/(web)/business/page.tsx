// ============================================
// 업체 문의 폼 — /business (공개, 로그인 불필요)
// 입점·상품추가·제휴·인스타 모니터링 요청을 받아 business_inquiries에 저장.
// 무료 리드 수집(받기만). 처리는 사업자등록 후 별도.
// 로그인 게이트 제외: src/proxy.ts EXEMPT_PREFIXES에 /business 등록됨.
// ============================================

import type { Metadata } from "next";
import { submitBusinessInquiryAction } from "@/modules/business/actions";
import { INQUIRY_TYPE_LABELS, type InquiryType } from "@/modules/business/repository";

export const metadata: Metadata = {
  title: "업체·브랜드 문의 · 엄빠레이더",
  description:
    "엄빠레이더에 체험단·협찬을 등록하거나 제휴를 원하시는 업체·브랜드를 위한 문의 페이지입니다.",
};

interface PageProps {
  searchParams: Promise<{ error?: string; type?: string }>;
}

const TYPE_ORDER: InquiryType[] = [
  "listing",
  "product",
  "partnership",
  "instagram",
];

export default async function BusinessPage({ searchParams }: PageProps) {
  const { error, type } = await searchParams;

  const errorMessage =
    error === "required"
      ? "업체명과 이메일은 꼭 입력해주세요."
      : error === "invalid_email"
        ? "이메일 형식이 올바르지 않아요."
        : null;

  const defaultType: InquiryType = (TYPE_ORDER as string[]).includes(type ?? "")
    ? (type as InquiryType)
    : "listing";

  return (
    <main className="mx-auto max-w-xl px-5 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          업체·브랜드 문의 🏢
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          엄빠레이더에 체험단·협찬을 알리고 싶으신가요?
        </p>
        <p className="mt-1 text-xs text-slate-400">
          남겨주시면 담당자가 이메일로 회신드려요.
        </p>
      </header>

      <form
        action={submitBusinessInquiryAction}
        className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
      >
        {errorMessage && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* 요청 유형 */}
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-900">
            어떤 문의인가요? <span className="text-rose-500">*</span>
          </span>
          <select
            name="inquiry_type"
            defaultValue={defaultType}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {INQUIRY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <span className="block text-[11px] text-slate-400">
            인스타 모니터링 요청 = 우리 계정 이벤트를 자동으로 모아주세요
          </span>
        </label>

        {/* 업체명 */}
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-900">
            업체·브랜드명 <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            name="company_name"
            required
            maxLength={60}
            placeholder="예: 베베로"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
          />
        </label>

        {/* 이메일 (필수) */}
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-900">
            회신 이메일 <span className="text-rose-500">*</span>
          </span>
          <input
            type="email"
            name="contact_email"
            required
            placeholder="reply@example.com"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
          />
        </label>

        {/* 담당자명 + 전화 (선택, 2열) */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-900">
              담당자명{" "}
              <span className="text-[11px] font-normal text-slate-400">
                (선택)
              </span>
            </span>
            <input
              type="text"
              name="contact_name"
              maxLength={30}
              placeholder="홍길동"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-900">
              연락처{" "}
              <span className="text-[11px] font-normal text-slate-400">
                (선택)
              </span>
            </span>
            <input
              type="tel"
              name="contact_phone"
              maxLength={20}
              placeholder="010-0000-0000"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
          </label>
        </div>

        {/* 링크 */}
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-900">
            인스타·홈페이지 링크{" "}
            <span className="text-[11px] font-normal text-slate-400">
              (선택)
            </span>
          </span>
          <input
            type="url"
            name="link_url"
            placeholder="https://instagram.com/your_brand"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
          />
          <span className="block text-[11px] text-slate-400">
            인스타 모니터링 요청이면 모니터링할 계정 주소를 적어주세요
          </span>
        </label>

        {/* 메시지 */}
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-900">
            요청 내용{" "}
            <span className="text-[11px] font-normal text-slate-400">
              (선택)
            </span>
          </span>
          <textarea
            name="message"
            rows={4}
            maxLength={1000}
            placeholder="어떤 협찬·체험단인지, 무엇을 원하시는지 자유롭게 적어주세요."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.99]"
        >
          문의 보내기
        </button>

        <p className="text-center text-[11px] text-slate-400">
          보내주신 정보는 회신 목적으로만 사용해요.
        </p>
      </form>
    </main>
  );
}

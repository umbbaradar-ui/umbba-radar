// ============================================
// 업체 문의 관리 — /admin/business
// business_inquiries 목록 + 상태 변경 (신규/연락함/완료/보류)
// ============================================

import { selectBusinessInquiries } from "@/modules/business/repository";
import {
  INQUIRY_TYPE_LABELS,
  INQUIRY_STATUS_LABELS,
  type InquiryStatus,
} from "@/modules/business/repository";
import { updateInquiryStatusAction } from "@/modules/business/actions";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<InquiryStatus, string> = {
  new: "bg-rose-100 text-rose-700",
  contacted: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-slate-100 text-slate-500",
};

const TYPE_COLOR: Record<string, string> = {
  listing: "bg-sky-100 text-sky-700",
  product: "bg-violet-100 text-violet-700",
  partnership: "bg-indigo-100 text-indigo-700",
  instagram: "bg-pink-100 text-pink-700",
};

export default async function AdminBusinessPage() {
  const inquiries = await selectBusinessInquiries();
  const newCount = inquiries.filter((i) => i.status === "new").length;

  return (
    <main className="mx-auto max-w-4xl px-5 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          업체 문의{" "}
          <span className="text-sm font-medium text-slate-400">
            (입점·상품·제휴·인스타)
          </span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          총 {inquiries.length}건 · 신규 {newCount}건 · 신규가 위로
        </p>
      </header>

      {inquiries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <p className="text-sm text-slate-400">아직 들어온 업체 문의가 없어요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((q) => (
            <article
              key={q.id}
              className="rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_COLOR[q.inquiry_type] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {INQUIRY_TYPE_LABELS[q.inquiry_type]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[q.status]}`}
                >
                  {INQUIRY_STATUS_LABELS[q.status]}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(q.created_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900">
                {q.company_name}
                {q.contact_name && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    · {q.contact_name}
                  </span>
                )}
              </h3>

              <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                <p>
                  ✉️{" "}
                  <a
                    href={`mailto:${q.contact_email}`}
                    className="text-sky-600 hover:underline"
                  >
                    {q.contact_email}
                  </a>
                  {q.contact_phone && <span className="ml-2">📞 {q.contact_phone}</span>}
                </p>
                {q.link_url && (
                  <p className="break-all">
                    🔗{" "}
                    <a
                      href={q.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline"
                    >
                      {q.link_url}
                    </a>
                  </p>
                )}
              </div>

              {q.message && (
                <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {q.message}
                </p>
              )}

              {/* 상태 변경 버튼 */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["new", "contacted", "done", "rejected"] as InquiryStatus[]).map(
                  (s) => (
                    <form
                      key={s}
                      action={updateInquiryStatusAction.bind(null, q.id, s)}
                    >
                      <button
                        type="submit"
                        disabled={q.status === s}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                          q.status === s
                            ? "cursor-default bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {INQUIRY_STATUS_LABELS[s]}
                      </button>
                    </form>
                  )
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

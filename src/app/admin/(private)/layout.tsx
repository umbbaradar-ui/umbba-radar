// ============================================
// 관리자 영역 레이아웃 (보호됨)
// 모든 자식 페이지에 진입 시 인증 체크 + 승인 대기 배지
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/modules/curation/actions";
import { getCounts } from "@/modules/curation/service";
import { countNewInquiries } from "@/modules/business/repository";
import { Logo } from "@/shared/ui/Logo";

const ADMIN_COOKIE = "umbba-admin";

export default async function AdminPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const expected = process.env.ADMIN_PASSWORD;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!expected || !token || token !== expected) {
    redirect("/admin/login");
  }

  // 승인 대기 카드 수 + 신규 업체 문의 수 (네비 배지용)
  let pendingCount = 0;
  let newInquiryCount = 0;
  try {
    const [counts, inquiries] = await Promise.all([
      getCounts(),
      countNewInquiries(),
    ]);
    pendingCount = counts.byStatus.pending;
    newInquiryCount = inquiries;
  } catch {
    // 조회 실패는 무시
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900"
            >
              <Logo size={20} className="text-rose-500" />
              <span>엄빠레이더 · 관리자</span>
            </Link>
            <Link
              href="/admin"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              카드 목록
            </Link>
            <Link
              href="/admin/accounts"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              title="1단계: 모니터링할 인스타 팔로잉 계정 등록"
            >
              ① 팔로잉 계정
            </Link>
            <Link
              href="/admin/bulk-ingest"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              title="2단계: CLI 가 자동 발견한 URL 검수 + Claude 분석 트리거"
            >
              ② URL 큐
            </Link>
            <Link
              href="/admin/queue"
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              title="3단계: Claude 분석 끝난 카드 검수 + 발행"
            >
              <span>③ 카드 승인</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
            <Link
              href="/admin/new"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              새 카드
            </Link>
            <Link
              href="/admin/stats"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              통계
            </Link>
            <Link
              href="/admin/users"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              회원 관리
            </Link>
            <Link
              href="/admin/business"
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              title="업체 입점·상품·제휴·인스타 모니터링 문의"
            >
              <span>업체 문의</span>
              {newInquiryCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {newInquiryCount}
                </span>
              )}
            </Link>
            <Link
              href="/"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100"
            >
              사이트 보기 ↗
            </Link>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              로그아웃
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}

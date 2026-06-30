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
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/shared/utils/admin-session";

export default async function AdminPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!verifyAdminToken(token)) {
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
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          {/* 상단: 로고 + 로그아웃 (항상 한 줄, justify-between) */}
          <div className="flex items-center justify-between gap-2 py-2.5">
            <Link
              href="/admin"
              className="flex min-w-0 items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900"
            >
              <Logo size={20} className="shrink-0 text-rose-500" />
              <span className="truncate">엄빠레이더 · 관리자</span>
            </Link>
            <form action={logoutAction} className="shrink-0">
              <button
                type="submit"
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                로그아웃
              </button>
            </form>
          </div>
          {/* 메뉴: 가로 스크롤 스트립 — 모바일에서 넘쳐도 페이지가 아닌 이 줄만 스크롤 */}
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavTab href="/admin">카드 목록</NavTab>
            <NavTab href="/admin/accounts" title="1단계: 모니터링할 인스타 팔로잉 계정 등록">
              ① 팔로잉 계정
            </NavTab>
            <NavTab href="/admin/bulk-ingest" title="2단계: CLI 가 자동 발견한 URL 검수 + Claude 분석 트리거">
              ② URL 큐
            </NavTab>
            <NavTab href="/admin/queue" title="3단계: Claude 분석 끝난 카드 검수 + 발행" badge={pendingCount}>
              ③ 카드 승인
            </NavTab>
            <NavTab href="/admin/new">새 카드</NavTab>
            <NavTab href="/admin/stats">통계</NavTab>
            <NavTab href="/admin/users">회원 관리</NavTab>
            <NavTab href="/admin/business" title="업체 입점·상품·제휴·인스타 모니터링 문의" badge={newInquiryCount}>
              업체 문의
            </NavTab>
            <NavTab href="/" muted>
              사이트 보기 ↗
            </NavTab>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}

// 관리자 네비 탭 — shrink-0 + whitespace-nowrap 로 가로 스크롤 스트립에서 안 찌그러지게
function NavTab({
  href,
  children,
  title,
  badge,
  muted,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
  badge?: number;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 ${
        muted ? "text-slate-400" : "text-slate-600"
      }`}
    >
      <span>{children}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

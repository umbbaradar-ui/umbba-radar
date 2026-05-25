// ============================================
// 알림 모아보기 페이지 — /notifications
// 자녀 시기 매칭 신규 카드 + 관심 카드 마감 임박
// 비로그인·자녀 미등록 사용자엔 가입/온보딩 CTA
// ============================================

import Link from "next/link";
import { getNotifications } from "@/modules/personalization/service-server";
import { getUserChildrenBirths } from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { NotificationsList } from "./_components/NotificationsList";
import { NotificationsHeader } from "./_components/NotificationsHeader";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [user, births] = await Promise.all([
    getCurrentUser(),
    getUserChildrenBirths(),
  ]);

  const hasChildren = births.length > 0;
  const notifications = user && hasChildren ? await getNotifications() : [];

  const latestEventAt = notifications[0]?.eventAt ?? null;

  const subtitle =
    user && hasChildren
      ? `내 아이에 맞는 혜택 ${notifications.length}건`
      : "내 아이에 맞는 혜택 알림";

  return (
    <>
      <NotificationsHeader subtitle={subtitle} />

      <main className="mx-auto max-w-3xl px-4 py-5">
        {!user ? (
          <CTACard
            icon="🔔"
            title="회원가입하면 맞춤 알림을 받을 수 있어요"
            description="내 아이 시기에 맞는 새 카드와, 관심 등록한 카드의 마감 임박을 모아 알려드려요."
            ctaLabel="회원가입하기"
            ctaHref="/signup"
            secondaryLabel="이미 계정 있어요"
            secondaryHref="/login"
          />
        ) : !hasChildren ? (
          <CTACard
            icon="👶"
            title="자녀 정보를 등록하면 알림이 시작돼요"
            description="아이 월령에 맞는 카드를 자동으로 골라드려요."
            ctaLabel="자녀 정보 등록하기"
            ctaHref="/me"
          />
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <NotificationsList
            notifications={notifications}
            latestEventAt={latestEventAt}
          />
        )}
      </main>
    </>
  );
}

// ============================================
// 빈 상태 — 알림 0건
// ============================================
function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-2xl">
        🐻
      </div>
      <p className="text-sm font-bold text-slate-900">
        최근 알림이 없어요
      </p>
      <p className="mt-1 text-xs text-slate-500">
        곧 내 아이에 맞는 새 혜택이 추가되면 알려드릴게요.
      </p>
    </div>
  );
}

// ============================================
// 비로그인·온보딩 CTA
// ============================================
function CTACard({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
}: {
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-amber-50 p-6">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl shadow-sm">
        {icon}
      </div>
      <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
        {description}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href={ctaHref}
          className="rounded-xl bg-rose-500 px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-rose-600"
        >
          {ctaLabel}
        </Link>
        {secondaryLabel && secondaryHref && (
          <Link
            href={secondaryHref}
            className="rounded-xl bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

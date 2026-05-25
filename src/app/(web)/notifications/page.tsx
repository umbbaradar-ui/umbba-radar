// ============================================
// 알림 모아보기 페이지 — /notifications
// 자녀 시기 매칭 신규 카드 + 관심 카드 마감 임박
// 비로그인·자녀 미등록 사용자엔 가입/온보딩 CTA
// ============================================

import Link from "next/link";
import { getNotifications } from "@/modules/personalization/service-server";
import { getUserChildrenBirths } from "@/modules/personalization/service-server";
import { getCurrentUser } from "@/modules/user/service";
import { STAGE_LABELS } from "@/shared/types/post";
import { getStageVisual } from "@/shared/utils/stage-visuals";
import { formatRelativeTime } from "@/shared/utils/relative-time";
import { calcDDay } from "@/shared/utils/dday";
import { NotificationSeenMarker } from "./_components/NotificationSeenMarker";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [user, births] = await Promise.all([
    getCurrentUser(),
    getUserChildrenBirths(),
  ]);

  const hasChildren = births.length > 0;
  const notifications = user && hasChildren ? await getNotifications() : [];

  const latestEventAt = notifications[0]?.eventAt ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* 페이지 진입 시 lastSeen 갱신 → 벨 배지 사라짐 */}
      {latestEventAt && <NotificationSeenMarker latestEventAt={latestEventAt} />}

      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            알림
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {user && hasChildren
              ? `내 아이에 맞는 혜택을 모아드려요 · ${notifications.length}건`
              : "내 아이에 맞는 혜택 알림"}
          </p>
        </div>
      </header>

      {/* 상태별 분기 */}
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
        <ul className="space-y-2">
          {notifications.map((n, idx) => (
            <NotificationItem
              key={`${n.kind}-${n.post.id}-${idx}`}
              item={n}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

// ============================================
// 알림 항목 — 시기 이모지 + 제목 + 시간 + (옵션) D-day
// ============================================
function NotificationItem({
  item,
}: {
  item: Awaited<ReturnType<typeof getNotifications>>[number];
}) {
  const visual = getStageVisual(item.post.stage_categories);
  const isUrgent = item.kind === "deadline_soon";
  const dday = calcDDay(item.post.deadline);
  const primaryStageLabel =
    item.post.stage_categories
      .filter((s) => s !== "all_ages")
      .map((s) => STAGE_LABELS[s])[0] ?? "전연령";

  return (
    <li>
      <Link
        href={`/post/${item.post.id}`}
        className={`flex items-start gap-3 rounded-2xl border bg-white p-3.5 transition hover:bg-slate-50 ${
          isUrgent ? "border-rose-200" : "border-slate-100"
        }`}
      >
        {/* 좌측: 시기 이모지 */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${visual.bgClass} text-xl`}
        >
          <span aria-hidden="true">{visual.emoji}</span>
        </div>

        {/* 우측: 정보 */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {item.post.brand_name && (
                <p className="truncate text-[11px] font-semibold text-rose-600">
                  {item.post.brand_name}
                </p>
              )}
              <p className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                {item.post.title}
              </p>
            </div>
            {dday && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                  dday.urgent
                    ? "bg-rose-500 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {dday.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {isUrgent ? (
              <span className="font-semibold text-rose-600">
                ⚠️ {item.reason}
              </span>
            ) : (
              <span className={visual.accentClass}>
                {primaryStageLabel} 시기 신규
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(item.eventAt)}</span>
          </div>
        </div>
      </Link>
    </li>
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

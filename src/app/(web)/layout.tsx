// ============================================
// (web) 채널 레이아웃 — 데스크탑 상단 네비 + 모바일 하단 탭 네비
// ============================================

import Link from "next/link";
import { getCurrentUser } from "@/modules/user/service";
import { UserMenu } from "@/modules/user/ui/UserMenu";
import { Logo } from "@/shared/ui/Logo";
import { BottomTabNav } from "./_components/BottomTabNav";
import { SplashScreen } from "./_components/SplashScreen";
import { ServiceWorkerRegister } from "./_components/ServiceWorkerRegister";
import { InstallBanner } from "./_components/InstallBanner";
import { InstallNavChip } from "@/modules/user/ui/InstallActions";
import { MigrationOnLogin } from "@/modules/personalization/ui/MigrationOnLogin";
import { NotificationBell } from "./_components/NotificationBell";
import { getNotifications } from "@/modules/personalization/service-server";

export default async function WebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  // 알림 벨 배지용 — 가장 최근 알림 시간만 헤더에 전달 (실제 목록은 /notifications에서)
  const notifications = user ? await getNotifications() : [];
  const latestNotifEventAt = notifications[0]?.eventAt ?? null;

  return (
    <>
      {/* fixed 컴포넌트는 wrapper 밖 (body 직속 자식) — 어떤 부모의 stacking
          context에도 영향 안 받게. 특히 BottomTabNav가 컨텐츠와 함께 스크롤
          되는 모바일 브라우저 버그 회피. */}
      <SplashScreen />
      <ServiceWorkerRegister />
      <InstallBanner />
      {user && <MigrationOnLogin userId={user.id} />}

      {/* 본문 wrapper — sticky footer 패턴 (이전엔 body가 flex였으나
          fixed 자식 호환성 위해 wrapper로 분리) */}
      <div className="flex min-h-dvh flex-col">

      {/* 데스크탑 상단 네비 (md+에서만 보임) */}
      <nav className="sticky top-0 z-20 hidden border-b border-amber-100 bg-white/85 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900"
          >
            <Logo size={22} className="text-rose-500" />
            <span>엄빠레이더</span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 font-medium text-slate-600 transition hover:bg-amber-100/60 hover:text-slate-900"
            >
              홈
            </Link>
            <Link
              href="/my"
              className="rounded-full px-3 py-1.5 font-medium text-slate-600 transition hover:bg-amber-100/60 hover:text-slate-900"
            >
              내 레이더
            </Link>
            <Link
              href="/archive"
              className="rounded-full px-3 py-1.5 font-medium text-slate-600 transition hover:bg-amber-100/60 hover:text-slate-900"
            >
              지난 이벤트
            </Link>
            <Link
              href="/submit"
              className="rounded-full bg-rose-50 px-3 py-1.5 font-medium text-rose-700 transition hover:bg-rose-100"
            >
              제보하기
            </Link>
            <div className="ml-1">
              <InstallNavChip variant="desktop" />
            </div>
            <div className="ml-1">
              <NotificationBell
                latestEventAt={latestNotifEventAt}
                variant="desktop"
              />
            </div>
            <div className="ml-2">
              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </nav>

      {/* 모바일 상단 미니 헤더 (md 미만에서만) */}
      <div className="pt-safe sticky top-0 z-20 border-b border-amber-100 bg-white/85 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 text-sm font-extrabold tracking-tight text-slate-900"
          >
            <Logo size={22} className="text-rose-500" />
            <span>엄빠레이더</span>
          </Link>
          <div className="flex items-center gap-1">
            {/* 미설치·미지원이면 자동으로 숨겨짐 → 설치한 사용자에겐 노출 X */}
            <InstallNavChip variant="mobile" />
            <NotificationBell
              latestEventAt={latestNotifEventAt}
              variant="mobile"
            />
          </div>
        </div>
      </div>

      {/* 본문 — flex-1로 footer를 하단으로 밀고, 모바일은 하단 탭에 가려지지 않게 pb-20 */}
      <div className="flex-1 pb-20 md:pb-0">{children}</div>

      {/* 데스크탑 푸터 (모바일에선 하단 탭이 푸터 역할) */}
      <footer className="mx-auto hidden max-w-6xl px-4 py-10 text-center text-xs text-slate-400 md:block">
        <p>엄빠레이더 · 부모님 대신 스캔 중</p>
        <p className="mt-2 space-x-3">
          <Link href="/submit" className="hover:text-slate-600 hover:underline">
            혜택 제보하기
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/archive" className="hover:text-slate-600 hover:underline">
            지난 이벤트
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="hover:text-slate-600 hover:underline">
            이용약관
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="hover:text-slate-600 hover:underline">
            개인정보처리방침
          </Link>
        </p>
      </footer>

      </div>
      {/* /본문 wrapper — BottomTabNav는 wrapper 밖, body 직속 자식으로 마운트 */}

      {/* 모바일 하단 탭 네비 (fixed, viewport 기준 고정) */}
      <BottomTabNav user={user} />
    </>
  );
}

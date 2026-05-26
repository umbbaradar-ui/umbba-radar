// ============================================
// 마이페이지 — /me
// 본인 정보 + 부모 역할 + 자녀 정보 수정
// (관심·신청함 카드는 /my)
// ============================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/shared/ui/Logo";
import { ChildrenForm } from "@/modules/user/ui/ChildrenForm";
import { getCurrentUser } from "@/modules/user/service";
import {
  getUserChildren,
  getUserProfile,
} from "@/modules/user/service-server";
import { signOutAction } from "@/modules/user/actions";
import { PushToggle } from "@/modules/notification/ui/PushToggle";
import { AccountDeleteSection } from "@/modules/user/ui/AccountDeleteSection";

// VAPID 공개 키 — env 미설정 시 PushToggle이 'unsupported' 처리
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ saved?: string }>;
}

export default async function MePage({ searchParams }: PageProps) {
  const { saved } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/me");
  }

  const [children, profile] = await Promise.all([
    getUserChildren(),
    getUserProfile(),
  ]);

  // ChildrenForm 입력 형식으로 변환
  const initialChildren =
    children.length > 0
      ? children.map((c) => ({
          gender: c.gender,
          birth_date: c.birth_date,
          nickname: c.nickname ?? "",
        }))
      : undefined;

  return (
    <main className="mx-auto max-w-md px-5 py-6">
      {/* 사용자 정보 카드 */}
      <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-base font-extrabold tracking-tight text-slate-900">
            내 정보
          </h1>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              로그아웃
            </button>
          </form>
        </header>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-base font-bold text-rose-700">
            {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-bold text-slate-900">
              {user.name ?? "사용자"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {user.email ?? ""}
            </p>
          </div>
        </div>
      </section>

      {/* 빠른 이동 */}
      <section className="mb-5 grid grid-cols-2 gap-2">
        <Link
          href="/my"
          className="rounded-xl bg-white p-4 text-center text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ⭐ 내 카드
        </Link>
        <Link
          href="/archive"
          className="rounded-xl bg-white p-4 text-center text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          🗓️ 지난 이벤트
        </Link>
      </section>

      {/* 푸시 알림 토글 */}
      <section className="mb-5">
        <PushToggle vapidPublicKey={VAPID_PUBLIC_KEY} />
      </section>

      {/* 자녀·역할 수정 */}
      <header className="mb-3">
        <h2 className="text-base font-extrabold tracking-tight text-slate-900">
          자녀·역할 정보
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          맞춤 큐레이션·알림에 사용돼요. 언제든 수정 가능.
        </p>
      </header>

      {saved === "1" && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ 변경사항이 저장됐어요.
        </div>
      )}

      <ChildrenForm
        next="/me?saved=1"
        initialParentRole={profile?.parent_role}
        initialChildren={initialChildren}
        isEditMode
      />

      {/* 계정 삭제 (위험 zone) — 페이지 하단 */}
      <AccountDeleteSection />

      <p className="mt-6 text-center">
        <Logo size={20} className="inline-block text-slate-300" />
      </p>
    </main>
  );
}

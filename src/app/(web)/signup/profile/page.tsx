// ============================================
// 가입 직후 온보딩 — /signup/profile
// 자녀 정보 입력 (다둥이 지원)
// ============================================

import { redirect } from "next/navigation";
import { Logo } from "@/shared/ui/Logo";
import { ChildrenForm } from "@/modules/user/ui/ChildrenForm";
import { getCurrentUser } from "@/modules/user/service";
import { safeNext } from "@/shared/utils/safe-next";

interface PageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function ProfileSetupPage({ searchParams }: PageProps) {
  const { next, error } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const errorMessage =
    error === "required"
      ? "자녀를 최소 한 명 입력해주세요."
      : error === "invalid"
        ? "모든 자녀의 성별·생년월일을 채워주세요."
        : null;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6 text-center">
        <div className="flex justify-center">
          <Logo size={40} className="text-rose-500" />
        </div>
        <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">
          👋 환영합니다, {user.name ?? "부모님"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          자녀 정보를 알려주시면 시기에 맞는 혜택을
          <br />
          자동으로 정리해드려요.
        </p>
      </header>

      <div className="mb-5 space-y-2 rounded-xl bg-rose-50/70 px-4 py-3 text-xs leading-relaxed text-rose-900">
        <p>
          💡 <strong>다둥이</strong>는 아래 <strong>"자녀 한 명 더 추가"</strong>
          로 등록하세요. 각 월령에 맞춰 추천이 따로 갑니다!
        </p>
        <p>
          🤰 <strong>임신 중</strong>이라면 성별은 <strong>"비공개"</strong>,
          생년월일은 <strong>출산 예정일</strong>을 입력하시면 돼요.
        </p>
        <p>
          🔔 <strong>별명</strong>을 입력하시면 알림이 더 친근해져요. 예:{" "}
          <em>"보리에게 적합한 ○○ 체험단 공고가 올라왔어요!"</em>
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

      <ChildrenForm next={safeNext(next)} />

      <p className="mt-5 text-center text-[11px] text-slate-400">
        나중에 마이페이지에서 언제든 수정할 수 있어요.
      </p>
    </main>
  );
}

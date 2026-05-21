// ============================================
// 새 카드 생성 페이지 — /admin/new
// ============================================

import { PostForm } from "@/modules/curation/ui/PostForm";
import { createPostAction } from "@/modules/curation/actions";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewPostPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  const errorMessage =
    error === "required"
      ? "제목과 원문 URL은 필수예요."
      : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          새 카드 등록
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          저장 후 상태가 <strong>발행</strong>이면 메인에 바로 보이고, <strong>초안</strong>·<strong>승인대기</strong>면 관리자에게만 보입니다.
        </p>
      </header>

      <PostForm
        action={createPostAction}
        submitLabel="등록"
        errorMessage={errorMessage}
      />
    </main>
  );
}

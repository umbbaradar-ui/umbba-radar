// ============================================
// 카드 수정 페이지 — /admin/[id]/edit
// ============================================

import { notFound } from "next/navigation";
import { getPostForAdmin } from "@/modules/curation/service";
import { updatePostAction } from "@/modules/curation/actions";
import { PostForm } from "@/modules/curation/ui/PostForm";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function EditPostPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const post = await getPostForAdmin(id);
  if (!post) notFound();

  const errorMessage =
    error === "required" ? "제목과 원문 URL은 필수예요." : null;

  // updatePostAction은 (id, formData)를 받음. bind로 id 고정
  const boundAction = updatePostAction.bind(null, id);

  return (
    <main className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            카드 수정
          </h1>
          <p className="mt-1 truncate text-xs text-slate-500">
            ID: <code>{id}</code>
          </p>
        </div>
        <a
          href={`/post/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          공개 페이지 보기 ↗
        </a>
      </header>

      <PostForm
        post={post}
        action={boundAction}
        submitLabel="수정 저장"
        errorMessage={errorMessage}
      />
    </main>
  );
}

// ============================================
// 새 카드 생성 페이지 — /admin/new
// AI 자동 추출 (URL) + 수동 폼 통합
// 인스타 다량은 CLI 운영 (tools/umbba-cli) 권장
// ============================================

import { PostFormWithAI } from "@/modules/curation/ui/PostFormWithAI";
import { createPostAction } from "@/modules/curation/actions";
import { extractFromUrlAction } from "@/modules/curation/ai-extract-actions";

// Vision API는 이미지 1장당 5~20초 걸리는 경우 있음.
// Vercel 기본 10초 함수 타임아웃이면 self-fail. Hobby plan은 60초까지 가능.
export const maxDuration = 60;

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewPostPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  const errorMessage =
    error === "required" ? "제목과 원문 URL은 필수예요." : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          새 카드 등록
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          🤖 AI 자동 추출을 사용하면 인스타 URL이나 스크린샷 한 장으로
          제목·브랜드·요약·태그·이미지를 한 번에 채울 수 있어요. 저장 후
          상태가 <strong>발행</strong>이면 메인에 바로 보이고,{" "}
          <strong>초안</strong>·<strong>승인대기</strong>면 관리자에게만
          보입니다.
        </p>
      </header>

      <PostFormWithAI
        action={createPostAction}
        extractFromUrl={extractFromUrlAction}
        submitLabel="등록"
        errorMessage={errorMessage}
      />
    </main>
  );
}

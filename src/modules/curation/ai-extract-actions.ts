"use server";

// ============================================
// AI 자동 추출 server actions
// URL → Claude/Gemini Vision → 카드 메타데이터 (제목·브랜드·요약·태그·마감일)
// 동시에 이미지를 Supabase Storage에 업로드 → thumbnail_url 반환
//
// 이미지 직접 업로드 모드는 글 짤림으로 신뢰성 낮아 제거.
// 인스타 다량 자동 등록은 CLI (tools/umbba-cli) 운영.
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  extractFromUrl,
  type VisionExtractResult,
} from "@/modules/ingestion/vision-extractor";
import { supabaseServer } from "@/shared/db/supabase-server";

// 주의: "use server" 파일에선 async 함수 외 export 불가.
// maxDuration은 호출 page (admin/new/page.tsx)에 설정함.

const ADMIN_COOKIE = "umbba-admin";

async function ensureAdmin() {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD env var is not configured");
  }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token !== expected) {
    redirect("/admin/login");
  }
}

export type AIExtractResponse =
  | { ok: true; data: VisionExtractResult; thumbnail_url: string | null }
  | { ok: false; error: string };

function mimeToExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/** Supabase Storage 'card-images' 버킷에 업로드 → 공개 URL 반환 */
async function uploadImageToStorage(
  bytes: Uint8Array,
  mime: string
): Promise<string | null> {
  const ext = mimeToExt(mime);
  const filename = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabaseServer.storage
    .from("card-images")
    .upload(filename, Buffer.from(bytes), {
      contentType: mime,
      cacheControl: "31536000",
    });

  if (uploadError) {
    console.error("[ai-extract] upload failed:", uploadError);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("card-images").getPublicUrl(filename);
  return publicUrl;
}

/** Vision provider env 확인 (Claude default) */
function ensureVisionProviderConfigured(): string | null {
  const provider = (process.env.VISION_PROVIDER ?? "claude").toLowerCase();
  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      return "서버에 GEMINI_API_KEY가 설정되지 않았어요. Vercel env 확인 필요.";
    }
  } else {
    if (!process.env.ANTHROPIC_API_KEY) {
      return "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요. Vercel env 확인 필요.";
    }
  }
  return null;
}

/**
 * URL에서 og:image 가져와 자동 추출
 * ⚠️ 인스타는 비로그인 봇 트래픽에 로그인 벽 HTML 반환하기 때문에 대부분 실패함.
 * 인스타 URL 들어오면 CLI 운영 안내로 fail-fast.
 */
export async function extractFromUrlAction(
  url: string
): Promise<AIExtractResponse> {
  const t0 = Date.now();
  try {
    try {
      await ensureAdmin();
    } catch {
      return { ok: false, error: "관리자 인증이 필요해요." };
    }

    const envErr = ensureVisionProviderConfigured();
    if (envErr) return { ok: false, error: envErr };

    if (!url || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: "올바른 URL이 아니에요 (http/https로 시작)." };
    }

    console.log(`[ai-extract url] fetching: ${url}`);
    const { result, imageBytes, imageMime, error } = await extractFromUrl(url);
    if (error || !result || !imageBytes) {
      const isInstagram = /instagram\.com/i.test(url);
      const fallbackMsg = isInstagram
        ? "⚠️ 인스타는 서버 IP 차단으로 URL 자동 추출이 막혀있어요.\n👉 로컬 CLI 로 처리하세요: tools/umbba-cli 에서 py ingest.py urls.txt 실행"
        : `${error || "URL에서 이미지를 추출할 수 없어요."}\n👉 인스타 다량 등록은 CLI 운영(tools/umbba-cli)을 사용하세요.`;
      console.error(
        `[ai-extract url] failed after ${Date.now() - t0}ms:`,
        error
      );
      return { ok: false, error: fallbackMsg };
    }

    const thumbnail_url = await uploadImageToStorage(
      imageBytes,
      imageMime || "image/jpeg"
    );

    console.log(
      `[ai-extract url] success: elapsed=${Date.now() - t0}ms title="${result.title}"`
    );
    return { ok: true, data: result, thumbnail_url };
  } catch (err) {
    console.error(
      `[ai-extract url] uncaught error after ${Date.now() - t0}ms:`,
      err
    );
    return {
      ok: false,
      error: `예상치 못한 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

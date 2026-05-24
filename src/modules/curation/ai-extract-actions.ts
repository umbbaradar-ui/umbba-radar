"use server";

// ============================================
// AI 자동 추출 server actions
// 이미지·URL → Gemini Vision → 카드 메타데이터 (제목·브랜드·요약·태그·마감일)
// 동시에 이미지를 Supabase Storage에 업로드 → thumbnail_url 반환
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  extractFromImageBytes,
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

/**
 * 사용자가 업로드한 이미지 파일에서 메타데이터 자동 추출
 * 동시에 Storage 업로드 → thumbnail_url 자동 설정
 */
export async function extractFromImageAction(
  formData: FormData
): Promise<AIExtractResponse> {
  const t0 = Date.now();
  try {
    try {
      await ensureAdmin();
    } catch {
      return { ok: false, error: "관리자 인증이 필요해요. /admin/login에서 다시 로그인해주세요." };
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("[ai-extract image] GEMINI_API_KEY missing");
      return {
        ok: false,
        error: "서버에 GEMINI_API_KEY가 설정되지 않았어요. Vercel env 확인 필요.",
      };
    }

    const file = formData.get("image");
    if (!file || !(file instanceof File)) {
      return { ok: false, error: "이미지 파일이 없어요." };
    }
    console.log(
      `[ai-extract image] start: name=${file.name} size=${(file.size / 1024 / 1024).toFixed(2)}MB type=${file.type}`
    );
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, error: `이미지가 너무 커요 (${(file.size / 1024 / 1024).toFixed(1)}MB). 10MB 이하로 축소해주세요.` };
    }
    if (file.size === 0) {
      return { ok: false, error: "빈 파일이에요." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";

    // 1) Vision 추출
    const result = await extractFromImageBytes(bytes, mime);
    if (!result) {
      console.error(
        `[ai-extract image] Gemini Vision returned null. elapsed=${Date.now() - t0}ms`
      );
      return {
        ok: false,
        error: "AI 추출이 실패했어요 (Gemini Vision 응답 없음). 잠시 후 다시 시도하거나 Vercel 로그를 확인해주세요.",
      };
    }

    // 2) Storage 업로드 (썸네일로 자동 설정) — 실패해도 추출 결과는 살림
    const thumbnail_url = await uploadImageToStorage(bytes, mime);
    if (!thumbnail_url) {
      console.warn(
        `[ai-extract image] storage upload failed but extraction succeeded`
      );
    }

    console.log(
      `[ai-extract image] success: elapsed=${Date.now() - t0}ms title="${result.title}" confidence=${result.confidence}`
    );
    return { ok: true, data: result, thumbnail_url };
  } catch (err) {
    console.error(
      `[ai-extract image] uncaught error after ${Date.now() - t0}ms:`,
      err
    );
    return {
      ok: false,
      error: `예상치 못한 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 인스타·블로그 URL에서 og:image 가져와 자동 추출
 * ⚠️ 인스타는 비로그인 봇 트래픽에 로그인 벽 HTML 반환하기 때문에 대부분 실패함.
 * 인스타 URL 들어오면 fail-fast 메시지로 스크린샷 fallback 안내.
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

    if (!process.env.GEMINI_API_KEY) {
      console.error("[ai-extract url] GEMINI_API_KEY missing");
      return {
        ok: false,
        error: "서버에 GEMINI_API_KEY가 설정되지 않았어요. Vercel env 확인 필요.",
      };
    }

    if (!url || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: "올바른 URL이 아니에요 (http/https로 시작)." };
    }

    // 인스타 URL 사전 안내 — 거의 차단되므로 시간 낭비 방지
    if (/instagram\.com\/p\//i.test(url) || /instagram\.com\/reel\//i.test(url)) {
      console.log(`[ai-extract url] instagram URL detected: ${url}`);
    }

    console.log(`[ai-extract url] fetching: ${url}`);
    const { result, imageBytes, imageMime, error } = await extractFromUrl(url);
    if (error || !result || !imageBytes) {
      const isInstagram = /instagram\.com/i.test(url);
      const fallbackMsg = isInstagram
        ? "⚠️ 인스타는 비로그인 봇 요청에 로그인 벽 HTML을 반환해서 URL 자동 추출이 막혀있어요.\n👉 인스타 스크린샷을 \"📷 스크린샷으로 추출\" 탭에 업로드하시면 동일하게 자동 분석돼요."
        : `${error || "URL에서 이미지를 추출할 수 없어요."}\n👉 스크린샷 업로드로 대체해주세요.`;
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

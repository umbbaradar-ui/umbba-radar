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
  try {
    await ensureAdmin();
  } catch {
    return { ok: false, error: "관리자 인증이 필요해요." };
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "이미지 파일이 없어요." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "10MB 이하 이미지만 가능해요." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  // 1) Vision 추출
  const result = await extractFromImageBytes(bytes, mime);
  if (!result) {
    return {
      ok: false,
      error: "AI 추출이 실패했어요. 이미지가 너무 흐릿하거나 잠시 후 다시 시도해주세요.",
    };
  }

  // 2) Storage 업로드 (썸네일로 자동 설정)
  const thumbnail_url = await uploadImageToStorage(bytes, mime);

  return { ok: true, data: result, thumbnail_url };
}

/**
 * 인스타·블로그 URL에서 og:image 가져와 자동 추출
 * 비공개 포스트나 인스타가 차단할 경우 실패 가능 → 스크린샷 fallback 안내
 */
export async function extractFromUrlAction(
  url: string
): Promise<AIExtractResponse> {
  try {
    await ensureAdmin();
  } catch {
    return { ok: false, error: "관리자 인증이 필요해요." };
  }

  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: "올바른 URL이 아니에요 (http/https로 시작)." };
  }

  const { result, imageBytes, imageMime, error } = await extractFromUrl(url);
  if (error || !result || !imageBytes) {
    return {
      ok: false,
      error:
        error ||
        "URL에서 이미지를 추출할 수 없어요. 인스타가 차단했을 수 있으니 스크린샷 업로드를 사용해주세요.",
    };
  }

  const thumbnail_url = await uploadImageToStorage(
    imageBytes,
    imageMime || "image/jpeg"
  );

  return { ok: true, data: result, thumbnail_url };
}

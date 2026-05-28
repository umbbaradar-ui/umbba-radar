// ============================================
// CLI 전용 — POST /api/admin/upload-image
// 이미지 base64 받아서 Supabase Storage 에 업로드 → 영구 URL 반환
// C 모드 (로컬 분석 + 썸네일 자동) 의 이미지 업로드 단계용.
//
// 인증: Bearer ${ADMIN_CLI_TOKEN}
// Body: { image_base64, image_mime }
// 응답: { ok: true, url: string }
// ============================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  image_base64: string;
  image_mime: string;
}

function mimeToExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_CLI_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_CLI_TOKEN env not configured" },
      { status: 500 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!body.image_base64 || !body.image_mime) {
    return NextResponse.json(
      { ok: false, error: "image_base64 + image_mime 필수" },
      { status: 400 }
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.image_base64, "base64");
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid base64" },
      { status: 400 }
    );
  }
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: `사이즈 오류 (${bytes.length} bytes)` },
      { status: 400 }
    );
  }

  const ext = mimeToExt(body.image_mime);
  const filename = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabaseServer.storage
    .from("card-images")
    .upload(filename, bytes, {
      contentType: body.image_mime,
      cacheControl: "31536000",
    });

  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: `upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("card-images").getPublicUrl(filename);

  return NextResponse.json({ ok: true, url: publicUrl });
}

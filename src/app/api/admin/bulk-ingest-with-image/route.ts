// ============================================
// CLI 전용 — POST /api/admin/bulk-ingest-with-image
//
// Phase 2 Python CLI (tools/umbba-cli/ingest.py)가 호출.
// 사용자 PC에서 gallery-dl로 인스타 게시물 이미지·캡션 다운 → 이 endpoint에 POST.
// 서버는 Storage 업로드 + Vision 분류 + draft 저장.
//
// 인증: Bearer ${ADMIN_CLI_TOKEN} (Vercel env 신규 추가 필요)
// Body: { url, caption, image_base64, image_mime }
//
// 처리 흐름:
//   1. 인증 검증
//   2. 중복 source_url 체크 → 이미 있으면 skip
//   3. base64 → Buffer → Supabase Storage 업로드 (썸네일)
//   4. Vision API로 메타 추출 (이미지 input → title·brand·body·stage·type·topic·deadline)
//   5. draft 카드 insert (source_type='ingestion')
//   6. JSON 응답
// ============================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { extractFromImageBytes } from "@/modules/ingestion/vision-extractor";

export const runtime = "nodejs";
export const maxDuration = 60; // Vision 5~20초 + Storage 업로드 안전 범위

interface RequestBody {
  url: string;
  caption?: string | null;
  image_base64: string;
  image_mime: string;
}

interface SuccessResponse {
  ok: true;
  status: "created" | "duplicate";
  post_id?: string;
  ai?: {
    title: string;
    confidence: number;
  };
}

interface ErrorResponse {
  ok: false;
  error: string;
}

function mimeToExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

async function uploadImageToStorage(
  bytes: Buffer,
  mime: string
): Promise<string | null> {
  const ext = mimeToExt(mime);
  const filename = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseServer.storage
    .from("card-images")
    .upload(filename, bytes, { contentType: mime, cacheControl: "31536000" });
  if (error) {
    console.error("[bulk-ingest-with-image] upload failed:", error);
    return null;
  }
  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("card-images").getPublicUrl(filename);
  return publicUrl;
}

export async function POST(
  request: Request
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  // 1. 인증
  const auth = request.headers.get("authorization");
  const expected = process.env.ADMIN_CLI_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_CLI_TOKEN env not configured on server" },
      { status: 500 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. body 파싱
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { url, caption, image_base64, image_mime } = body;
  if (!url || !image_base64 || !image_mime) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (url, image_base64, image_mime)" },
      { status: 400 }
    );
  }

  // 3. 중복 source_url 체크
  const { data: existing } = await supabaseServer
    .from("posts")
    .select("id")
    .eq("source_url", url)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: true,
      status: "duplicate",
      post_id: (existing as { id: string }).id,
    });
  }

  // 4. base64 디코딩 + 사이즈 체크 (10MB)
  let bytes: Buffer;
  try {
    bytes = Buffer.from(image_base64, "base64");
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid base64 image data" },
      { status: 400 }
    );
  }
  if (bytes.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Empty image" },
      { status: 400 }
    );
  }
  if (bytes.length > 10 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: `Image too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB > 10MB)` },
      { status: 400 }
    );
  }

  // 5. Storage 업로드 (썸네일)
  const thumbnailUrl = await uploadImageToStorage(bytes, image_mime);
  if (!thumbnailUrl) {
    return NextResponse.json(
      { ok: false, error: "Storage upload failed" },
      { status: 500 }
    );
  }

  // 6. Vision API 호출 (이미지 input)
  const vis = await extractFromImageBytes(new Uint8Array(bytes), image_mime);
  if (!vis) {
    // Vision 실패 — 이미지만 박힌 단순 draft 저장 (사용자가 큐에서 정리)
    const { data: inserted, error: insertError } = await supabaseServer
      .from("posts")
      .insert({
        kind: "recruiting" as const, // 자동수집은 무조건 모집중
        title: "(CLI 등록 — Vision 실패, 큐에서 정리)",
        brand_name: null,
        thumbnail_url: thumbnailUrl,
        source_url: url,
        // 인스타 캡션 길이는 평균 1000~2000자. 너무 짧게 자르면 신청방법·이벤트 정보 손실
        body: caption?.slice(0, 2000) ?? null,
        deadline: null,
        deadline_unknown: false,
        stage_categories: [],
        type_tags: [],
        topic: "parenting",
        is_sponsored: false,
        // CLI 자동 생성은 운영자가 곧바로 검수할 수 있게 pending 으로
        status: "pending" as const,
        source_type: "ingestion" as const,
      })
      .select("id")
      .single();
    if (insertError) {
      return NextResponse.json(
        { ok: false, error: `Insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      status: "created",
      post_id: (inserted as { id: string }).id,
    });
  }

  // 7. Vision 성공 — 풍부한 draft
  // 캡션이 명시적으로 들어왔으면 그것 우선 (사용자 직접 복사한 본문), 없으면 Vision body 사용
  const body_text = caption?.trim() || vis.body || null;
  const deadlineUnknown = !vis.deadline;

  const { data: inserted, error: insertError } = await supabaseServer
    .from("posts")
    .insert({
      // 자동수집은 무조건 모집중 — Vision이 group_buy 반환해도 운영 정책상 recruiting
      kind: "recruiting" as const,
      title: vis.title.slice(0, 120),
      brand_name: vis.brand_name,
      thumbnail_url: thumbnailUrl,
      source_url: url,
      // 인스타 캡션은 평균 1000~2000자. 본문에 신청방법·이벤트 정보 보존
      body: body_text?.slice(0, 2000) ?? null,
      deadline: vis.deadline,
      deadline_unknown: deadlineUnknown,
      stage_categories: vis.stage_categories ?? [],
      type_tags: vis.type_tags ?? [],
      topic: vis.topic === "living" ? "living" : "parenting",
      is_sponsored: false,
      // CLI 자동 생성은 운영자가 곧바로 검수할 수 있게 pending 으로
      status: "pending" as const,
      source_type: "ingestion" as const,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: `Insert failed: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: "created",
    post_id: (inserted as { id: string }).id,
    ai: { title: vis.title, confidence: vis.confidence },
  });
}

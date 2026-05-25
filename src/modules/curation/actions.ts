"use server";

// ============================================
// Curation Server Actions — 폼에서 직접 호출
// 모든 액션은 인증 체크 후 수행
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  insertPost,
  updatePost,
  deletePost,
  approvePost,
  type PostInsertInput,
} from "./repository";
import { getServerSupabase } from "@/shared/db/supabase-ssr";
import { supabaseServer } from "@/shared/db/supabase-server";
import type { PostStatus } from "@/shared/types/post";

const ADMIN_COOKIE = "umbba-admin";

async function ensureAdmin(): Promise<void> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error(
      "ADMIN_PASSWORD env var is not configured. Set it in .env.local and Vercel."
    );
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token || token !== expected) {
    redirect("/admin/login");
  }
}

/** 마감일 미정 카드의 자동 종료 기간 (등록일 + N일).
 *  "use server" 파일은 모듈 레벨 export로 함수만 허용 → 내부 const로 보관.
 *  변경 시 UI 라벨(PostForm UNKNOWN_DAYS_LABEL)·ingestion service의 상수와 동기화 필요. */
const UNKNOWN_DEADLINE_DAYS = 7;

function parseFormToPost(formData: FormData): PostInsertInput {
  const get = (k: string) => formData.get(k)?.toString().trim() ?? "";
  const getOrNull = (k: string) => {
    const v = formData.get(k)?.toString().trim();
    return v ? v : null;
  };
  const getAll = (k: string) =>
    formData.getAll(k).map((v) => v.toString()).filter(Boolean);

  const deadlineUnknown = formData.get("deadline_unknown") === "on";

  let deadline: string | null;
  if (deadlineUnknown) {
    // 마감 미정 → 등록(=now) +N일을 deadline에 자동 채움 (모든 정렬/만료 로직 그대로 사용)
    const ms = Date.now() + UNKNOWN_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
    deadline = new Date(ms).toISOString();
  } else {
    const deadlineRaw = get("deadline");
    // datetime-local은 timezone 정보 없음. Vercel 서버 local time(UTC/US 등)에 의존하면
    // 캘린더 날짜가 1일 밀릴 수 있어서 KST(+09:00)로 명시적 해석
    deadline = deadlineRaw
      ? new Date(`${deadlineRaw}:00+09:00`).toISOString()
      : null;
  }

  const topic = get("topic") || "parenting";

  // 검색 키워드 — 공백·중복 정리 후 콤마 구분 형식으로 저장
  // 예: "기저귀, 팬티 , 기저귀팬티" → "기저귀,팬티,기저귀팬티"
  const searchKeywordsRaw = get("search_keywords");
  const searchKeywords = searchKeywordsRaw
    ? Array.from(
        new Set(
          searchKeywordsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      ).join(",")
    : null;

  return {
    kind: get("kind") || "recruiting",
    title: get("title"),
    brand_name: getOrNull("brand_name"),
    thumbnail_url: getOrNull("thumbnail_url"),
    source_url: get("source_url"),
    body: getOrNull("body"),
    search_keywords: searchKeywords,
    deadline,
    deadline_unknown: deadlineUnknown,
    reviewer_handle: getOrNull("reviewer_handle"),
    stage_categories: getAll("stage_categories"),
    type_tags: getAll("type_tags"),
    topic: topic === "living" ? "living" : "parenting",
    is_sponsored: formData.get("is_sponsored") === "on",
    status: (get("status") || "draft") as PostStatus,
  };
}

// ============================================
// 로그인 — 아이디 + 비밀번호
// ============================================
export async function loginAction(formData: FormData): Promise<void> {
  const expectedId = process.env.ADMIN_ID;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedId || !expectedPassword) {
    redirect("/admin/login?error=notconfigured");
  }
  const id = formData.get("id")?.toString();
  const password = formData.get("password")?.toString();
  if (id !== expectedId || password !== expectedPassword) {
    redirect("/admin/login?error=invalid");
  }
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, expectedPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1주
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ============================================
// CRUD
// ============================================
export async function createPostAction(formData: FormData): Promise<void> {
  await ensureAdmin();
  const input = parseFormToPost(formData);
  if (!input.title || !input.source_url) {
    redirect("/admin/new?error=required");
  }
  await insertPost({ ...input, source_type: "admin" });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=created");
}

// ============================================
// 승인 (pending → published)
// ============================================
export async function approvePostAction(id: string): Promise<void> {
  await ensureAdmin();
  await approvePost(id);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/queue");
  redirect("/admin/queue?ok=approved");
}

// ============================================
// 사용자 제보 — 최소 입력 (URL + 한 줄 설명)
// 카테고리·시기·유형은 관리자가 큐에서 정리. 사용자 부담 ↓
// 항상 status='pending', source_type='submission'
// ============================================
function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function submitPostAction(formData: FormData): Promise<void> {
  const source_url = formData.get("source_url")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";
  const handle =
    formData.get("submitter_handle")?.toString().trim() || null;

  if (!source_url || !description) {
    redirect("/submit?error=required");
  }
  if (!isValidUrl(source_url)) {
    redirect("/submit?error=invalid_url");
  }

  // 로그인 사용자라면 user_id 함께
  let submitterUserId: string | null = null;
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    submitterUserId = user?.id ?? null;
  } catch {
    // 로그인 안 됨 — 익명 제보로 진행
  }

  // 최소 정보만 저장. title 은 description 앞부분 사용 (관리자가 큐에서 정제)
  await insertPost({
    title: description.slice(0, 100),
    brand_name: null,
    thumbnail_url: null,
    source_url,
    body: description,
    deadline: null,
    reviewer_handle: null,
    stage_categories: [],
    type_tags: [],
    is_sponsored: false,
    status: "pending",
    source_type: "submission",
    submitter_handle: handle,
    submitter_user_id: submitterUserId,
    kind: "recruiting", // 기본값 — 관리자가 큐에서 review/group_buy로 변경 가능
  });
  revalidatePath("/admin/queue");
  redirect("/submit/thanks");
}

export async function updatePostAction(
  id: string,
  formData: FormData
): Promise<void> {
  await ensureAdmin();
  const input = parseFormToPost(formData);
  if (!input.title || !input.source_url) {
    redirect(`/admin/${id}/edit?error=required`);
  }
  await updatePost(id, input);
  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/admin");
  redirect("/admin?ok=updated");
}

export async function deletePostAction(id: string): Promise<void> {
  await ensureAdmin();
  await deletePost(id);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=deleted");
}

// ============================================
// 이미지 업로드 — Supabase Storage 'card-images' 버킷
// 관리자 인증 필수. 5MB 이하 이미지 한 장 업로드 → public URL 반환
// ============================================

export type UploadImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadImageAction(
  formData: FormData
): Promise<UploadImageResult> {
  try {
    await ensureAdmin();
  } catch {
    return { ok: false, error: "관리자 인증이 필요해요." };
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "이미지 파일이 없어요." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "5MB 이하 이미지만 업로드 가능해요." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "이미지 형식이 아니에요." };
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
    ? ext
    : "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseServer.storage
    .from("card-images")
    .upload(filename, buffer, {
      contentType: file.type,
      cacheControl: "31536000", // 1년
    });

  if (uploadError) {
    return { ok: false, error: `업로드 실패: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("card-images").getPublicUrl(filename);

  return { ok: true, url: publicUrl };
}

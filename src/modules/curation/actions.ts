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

function parseFormToPost(formData: FormData): PostInsertInput {
  const get = (k: string) => formData.get(k)?.toString().trim() ?? "";
  const getOrNull = (k: string) => {
    const v = formData.get(k)?.toString().trim();
    return v ? v : null;
  };
  const getAll = (k: string) =>
    formData.getAll(k).map((v) => v.toString()).filter(Boolean);

  const deadlineRaw = get("deadline");
  const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;

  return {
    kind: get("kind") || "recruiting",
    title: get("title"),
    brand_name: getOrNull("brand_name"),
    thumbnail_url: getOrNull("thumbnail_url"),
    source_url: get("source_url"),
    body: getOrNull("body"),
    deadline,
    reviewer_handle: getOrNull("reviewer_handle"),
    stage_categories: getAll("stage_categories"),
    type_tags: getAll("type_tags"),
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
// 사용자 제보 (공개 — 인증 없음)
// 항상 status='pending', source_type='submission'
// ============================================
export async function submitPostAction(formData: FormData): Promise<void> {
  const input = parseFormToPost(formData);
  if (!input.title || !input.source_url) {
    redirect("/submit?error=required");
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

  const handle = formData.get("submitter_handle")?.toString().trim() || null;

  await insertPost({
    ...input,
    status: "pending", // 강제
    source_type: "submission", // 강제
    submitter_handle: handle,
    submitter_user_id: submitterUserId,
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

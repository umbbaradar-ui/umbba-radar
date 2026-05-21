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
  type PostInsertInput,
} from "./repository";
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
// 로그인
// ============================================
export async function loginAction(formData: FormData): Promise<void> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    redirect("/admin/login?error=notconfigured");
  }
  const password = formData.get("password")?.toString();
  if (password !== expected) {
    redirect("/admin/login?error=invalid");
  }
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, expected, {
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
  await insertPost(input);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=created");
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

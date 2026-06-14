"use server";

// ============================================
// instagram_accounts server actions (어드민 페이지용)
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addUsernames,
  setActive,
  deleteAccount,
} from "./repository";
import type { AddAccountsResult } from "./types";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/shared/utils/admin-session";

async function ensureAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) redirect("/admin/login");
}

export type AddAccountsActionResult =
  | { ok: true; data: AddAccountsResult }
  | { ok: false; error: string };

export async function addAccountsAction(
  formData: FormData
): Promise<AddAccountsActionResult> {
  await ensureAdmin();

  const raw = String(formData.get("usernames") ?? "");
  if (!raw.trim()) {
    return { ok: false, error: "username 을 한 줄에 하나씩 입력해주세요." };
  }

  // 줄바꿈·쉼표·공백·탭 다 split
  const items = raw
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return { ok: false, error: "유효한 username 이 없어요." };
  }
  if (items.length > 500) {
    return { ok: false, error: `한 번에 500개까지만 가능해요 (현재 ${items.length}개).` };
  }

  try {
    const data = await addUsernames(items);
    revalidatePath("/admin/accounts");
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function toggleAccountAction(
  id: string,
  active: boolean
): Promise<void> {
  await ensureAdmin();
  await setActive(id, active);
  revalidatePath("/admin/accounts");
}

export async function deleteInstagramAccountAction(
  id: string
): Promise<void> {
  await ensureAdmin();
  await deleteAccount(id);
  revalidatePath("/admin/accounts");
}

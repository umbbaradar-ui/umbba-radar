"use server";

// ============================================
// ingest_queue server actions
// 웹 페이지에서 URL 리스트 입력 → 큐에 추가 / 항목 삭제 / 재시도
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addUrlsToQueue,
  deleteQueueItem,
  requeue,
} from "./repository";
import type { AddUrlsResult } from "./types";

const ADMIN_COOKIE = "umbba-admin";

async function ensureAdmin() {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD env var is not configured");
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token !== expected) redirect("/admin/login");
}

export type AddUrlsActionResult =
  | { ok: true; data: AddUrlsResult }
  | { ok: false; error: string };

export async function addUrlsAction(
  formData: FormData
): Promise<AddUrlsActionResult> {
  await ensureAdmin();

  const raw = String(formData.get("urls") ?? "");
  if (!raw.trim()) {
    return { ok: false, error: "URL을 한 줄에 하나씩 입력해주세요." };
  }

  // 줄바꿈 + 콤마 + 공백 모두 split
  const urls = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    return { ok: false, error: "URL을 한 줄에 하나씩 입력해주세요." };
  }
  if (urls.length > 200) {
    return {
      ok: false,
      error: `한 번에 200개까지만 가능해요 (현재 ${urls.length}개).`,
    };
  }

  try {
    const data = await addUrlsToQueue(urls);
    revalidatePath("/admin/queue-bulk");
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: `큐 저장 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function deleteQueueItemAction(id: string): Promise<void> {
  await ensureAdmin();
  await deleteQueueItem(id);
  revalidatePath("/admin/queue-bulk");
}

export async function requeueAction(id: string): Promise<void> {
  await ensureAdmin();
  await requeue(id);
  revalidatePath("/admin/queue-bulk");
}

"use server";

// ============================================
// Business Inquiry Server Actions
// 공개 폼(submitBusinessInquiryAction): 인증 불필요, 누구나 제출
// 관리자(updateInquiryStatusAction): 어드민 쿠키 검증
// ============================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  insertBusinessInquiry,
  updateBusinessInquiryStatus,
  INQUIRY_TYPE_LABELS,
  type InquiryType,
  type InquiryStatus,
} from "./repository";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/shared/utils/admin-session";

const VALID_TYPES: InquiryType[] = [
  "listing",
  "product",
  "partnership",
  "instagram",
];
const VALID_STATUSES: InquiryStatus[] = [
  "new",
  "contacted",
  "done",
  "rejected",
];

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ============================================
// 공개 폼 제출 — 인증 불필요
// ============================================
export async function submitBusinessInquiryAction(
  formData: FormData
): Promise<void> {
  const get = (k: string) => formData.get(k)?.toString().trim() ?? "";

  const rawType = get("inquiry_type");
  const inquiry_type = (VALID_TYPES as string[]).includes(rawType)
    ? (rawType as InquiryType)
    : "listing";
  const company_name = get("company_name");
  const contact_email = get("contact_email");

  // 필수 검증
  if (!company_name || !contact_email) {
    redirect("/business?error=required");
  }
  if (!isValidEmail(contact_email)) {
    redirect("/business?error=invalid_email");
  }

  await insertBusinessInquiry({
    inquiry_type,
    company_name,
    contact_name: get("contact_name") || null,
    contact_email,
    contact_phone: get("contact_phone") || null,
    link_url: get("link_url") || null,
    message: get("message") || null,
  });

  // 텔레그램 즉시 알림 (env 미설정이면 내부에서 no-op). 실패해도 제출은 성공 처리.
  try {
    await notifyBusinessInquiry({
      inquiry_type,
      company_name,
      contact_email,
      link_url: get("link_url") || null,
    });
  } catch {
    // 알림 실패는 무시 — 문의는 이미 저장됨
  }

  redirect("/business/thanks");
}

/** 업체 문의 텔레그램 알림 (notify-telegram과 별개의 단건 알림) */
async function notifyBusinessInquiry(info: {
  inquiry_type: InquiryType;
  company_name: string;
  contact_email: string;
  link_url: string | null;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // 미설정 → no-op

  const text = [
    `🏢 <b>새 업체 문의</b>`,
    ``,
    `유형: <b>${INQUIRY_TYPE_LABELS[info.inquiry_type]}</b>`,
    `업체: <b>${info.company_name}</b>`,
    `이메일: ${info.contact_email}`,
    info.link_url ? `링크: ${info.link_url}` : null,
    ``,
    `👉 https://umbba-radar.com/admin/business`,
  ]
    .filter(Boolean)
    .join("\n");

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

// ============================================
// 관리자 — 상태 변경
// ============================================
async function ensureAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    redirect("/admin/login");
  }
}

export async function updateInquiryStatusAction(
  id: string,
  status: string
): Promise<void> {
  await ensureAdmin();
  const next = (VALID_STATUSES as string[]).includes(status)
    ? (status as InquiryStatus)
    : "new";
  await updateBusinessInquiryStatus(id, next);
  revalidatePath("/admin/business");
}

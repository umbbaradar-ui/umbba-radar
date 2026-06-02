// ============================================
// Business Inquiry Repository — 업체(B2B) 문의 DB 접근층
// /business 공개 폼 → 저장, /admin/business → 조회·상태변경
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";

export type InquiryType = "listing" | "product" | "partnership" | "instagram";
export type InquiryStatus = "new" | "contacted" | "done" | "rejected";

export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  listing: "입점(체험단 등록)",
  product: "상품 추가 요청",
  partnership: "제휴 제안",
  instagram: "인스타 모니터링 요청",
};

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "신규",
  contacted: "연락함",
  done: "완료",
  rejected: "보류",
};

export interface BusinessInquiry {
  id: string;
  inquiry_type: InquiryType;
  company_name: string;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  link_url: string | null;
  message: string | null;
  status: InquiryStatus;
  admin_note: string | null;
  created_at: string;
}

export interface BusinessInquiryInput {
  inquiry_type: InquiryType;
  company_name: string;
  contact_name?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  link_url?: string | null;
  message?: string | null;
}

export async function insertBusinessInquiry(
  input: BusinessInquiryInput
): Promise<BusinessInquiry> {
  const { data, error } = await supabaseServer
    .from("business_inquiries")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(`insertBusinessInquiry: ${error.message}`);
  return data as BusinessInquiry;
}

export async function selectBusinessInquiries(): Promise<BusinessInquiry[]> {
  // 미처리(new) 먼저, 그 안에서 최신순
  const { data, error } = await supabaseServer
    .from("business_inquiries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`selectBusinessInquiries: ${error.message}`);
  const rows = (data ?? []) as BusinessInquiry[];
  // new를 맨 위로 끌어올림 (created_at desc는 유지)
  return rows.sort((a, b) => {
    if (a.status === "new" && b.status !== "new") return -1;
    if (b.status === "new" && a.status !== "new") return 1;
    return 0;
  });
}

export async function updateBusinessInquiryStatus(
  id: string,
  status: InquiryStatus,
  adminNote?: string | null
): Promise<void> {
  const patch: { status: InquiryStatus; admin_note?: string | null } = { status };
  if (adminNote !== undefined) patch.admin_note = adminNote;
  const { error } = await supabaseServer
    .from("business_inquiries")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(`updateBusinessInquiryStatus: ${error.message}`);
}

export async function countNewInquiries(): Promise<number> {
  const { count, error } = await supabaseServer
    .from("business_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) return 0;
  return count ?? 0;
}

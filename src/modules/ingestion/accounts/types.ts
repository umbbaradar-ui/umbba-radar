// ============================================
// instagram_accounts 타입
// ============================================

export interface InstagramAccount {
  id: string;
  username: string;
  active: boolean;
  last_scanned_at: string | null;
  last_new_count: number;
  last_error: string | null;
  note: string | null;
  created_at: string;
}

export interface AddAccountsResult {
  added: number;
  skipped_duplicate: number;
  invalid: number;
  invalidUsernames: string[];
}

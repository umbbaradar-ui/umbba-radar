// ============================================
// ingest_queue 타입 (DB row + 입력)
// ============================================

export type IngestQueueStatus =
  | "todo"
  | "processing"
  | "done"
  | "duplicate"
  | "failed";

export interface IngestQueueItem {
  id: string;
  url: string;
  status: IngestQueueStatus;
  error: string | null;
  post_id: string | null;
  attempts: number;
  created_at: string;
  claimed_at: string | null;
  processed_at: string | null;
  created_by: string | null;
}

export interface AddUrlsResult {
  added: number;
  skipped_duplicate_in_queue: number;
  skipped_already_posted: number;
  invalid: number;
  invalidUrls: string[];
}

export interface QueueStats {
  todo: number;
  processing: number;
  done: number;
  duplicate: number;
  failed: number;
  total: number;
}

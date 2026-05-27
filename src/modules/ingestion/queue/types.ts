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
  /** scan 모드가 채움 — 검수 화면 미리보기용 */
  source_username: string | null;
  source_post_date: string | null;
  caption_preview: string | null;
}

/** addUrlsToQueue 입력 — string 도 호환 (기존 textarea 등록 흐름) */
export type UrlInput =
  | string
  | {
      url: string;
      source_username?: string | null;
      source_post_date?: string | null;
      caption_preview?: string | null;
    };

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

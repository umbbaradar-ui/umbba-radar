// ============================================
// Ingestion Service — orchestration
// 흐름: 네이버 → 중복 제거 → 배치 AI 정규화 (RPM 제한 대응) → posts(pending) INSERT
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import { searchBlog, type NaverBlogItem } from "./sources/naver-search";
import { normalizeBatch, type NormalizerInput } from "./normalizer";
import {
  NAVER_KEYWORDS,
  NAVER_DISPLAY_PER_KEYWORD,
  MIN_CONFIDENCE,
  NORMALIZE_BATCH_SIZE,
  GEMINI_DELAY_MS,
} from "./keywords";

export interface IngestionStats {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  keywordsProcessed: number;
  fetched: number;
  duplicates: number;
  normalized: number;
  filtered: number;
  inserted: number;
  errors: number;
  errorMessages: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function existingSourceUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const { data } = await supabaseServer
    .from("posts")
    .select("source_url")
    .in("source_url", urls);
  return new Set((data ?? []).map((row) => row.source_url as string));
}

export async function runIngestion(): Promise<IngestionStats> {
  const startedAt = new Date();
  const stats: IngestionStats = {
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    durationMs: 0,
    keywordsProcessed: 0,
    fetched: 0,
    duplicates: 0,
    normalized: 0,
    filtered: 0,
    inserted: 0,
    errors: 0,
    errorMessages: [],
  };

  // 1. 네이버에서 전부 수집
  const allItems: NaverBlogItem[] = [];
  for (const keyword of NAVER_KEYWORDS) {
    try {
      const items = await searchBlog(keyword, NAVER_DISPLAY_PER_KEYWORD);
      stats.fetched += items.length;
      stats.keywordsProcessed++;
      allItems.push(...items);
    } catch (e) {
      stats.errors++;
      stats.errorMessages.push(`naver "${keyword}": ${String(e)}`);
    }
  }

  // 2. URL 기준 in-batch 중복 제거 + DB 중복 체크
  const seenUrls = new Set<string>();
  const uniqueItems = allItems.filter((it) => {
    if (seenUrls.has(it.link)) return false;
    seenUrls.add(it.link);
    return true;
  });
  stats.duplicates += allItems.length - uniqueItems.length;

  const dbExisting = await existingSourceUrls(uniqueItems.map((it) => it.link));
  const candidates = uniqueItems.filter((it) => {
    if (dbExisting.has(it.link)) {
      stats.duplicates++;
      return false;
    }
    return true;
  });

  // 3. 배치 AI 정규화 + Rate Limit 회피 지연
  for (let i = 0; i < candidates.length; i += NORMALIZE_BATCH_SIZE) {
    const batch = candidates.slice(i, i + NORMALIZE_BATCH_SIZE);
    const inputs: NormalizerInput[] = batch.map((it) => ({
      title: it.title,
      description: it.description,
      link: it.link,
      postdate: it.postdate,
    }));

    let results;
    try {
      results = await normalizeBatch(inputs);
    } catch (e) {
      stats.errors += batch.length;
      stats.errorMessages.push(`batch ${i}: ${String(e)}`);
      // 첫 배치 외 다음 배치들도 같은 이유로 실패할 가능성 → 빠르게 종료
      if (i === 0) break;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const norm = results[j];
      const item = batch[j];
      if (!norm) {
        stats.errors++;
        continue;
      }
      if (!norm.is_actual_event || norm.confidence < MIN_CONFIDENCE) {
        stats.filtered++;
        continue;
      }
      stats.normalized++;

      // AI가 마감일 추출 못 했으면 deadline_unknown=true + 등록일 +7일 자동 채움
      // (수동 admin 카드와 동일한 정책, UNKNOWN_DEADLINE_DAYS와 동기화)
      const UNKNOWN_DEADLINE_DAYS = 7;
      const deadlineUnknown = !norm.deadline;
      const effectiveDeadline = deadlineUnknown
        ? new Date(
            Date.now() + UNKNOWN_DEADLINE_DAYS * 24 * 60 * 60 * 1000
          ).toISOString()
        : norm.deadline;

      const { error: insertError } = await supabaseServer.from("posts").insert({
        title: norm.title.slice(0, 120),
        brand_name: norm.brand_name,
        body: norm.body?.slice(0, 500) ?? null,
        source_url: item.link,
        kind: norm.kind,
        stage_categories: norm.stage_categories ?? [],
        type_tags: norm.type_tags ?? [],
        topic: norm.topic === "living" ? "living" : "parenting",
        deadline: effectiveDeadline,
        deadline_unknown: deadlineUnknown,
        status: "pending",
        source_type: "ingestion",
      });

      if (insertError) {
        stats.errors++;
        stats.errorMessages.push(
          `insert "${item.link}": ${insertError.message}`
        );
      } else {
        stats.inserted++;
      }
    }

    // 다음 배치 전 지연 (마지막 배치 후엔 생략)
    if (i + NORMALIZE_BATCH_SIZE < candidates.length) {
      await sleep(GEMINI_DELAY_MS);
    }
  }

  const finishedAt = new Date();
  stats.finishedAt = finishedAt.toISOString();
  stats.durationMs = finishedAt.getTime() - startedAt.getTime();
  return stats;
}

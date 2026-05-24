// ============================================
// Ingestion Service — orchestration
// 일 1회 cron이 이 함수를 호출
// 흐름: 네이버 → AI 정규화 → 중복 제거 → posts(pending) INSERT
// ============================================

import "server-only";
import { supabaseServer } from "@/shared/db/supabase-server";
import { searchBlog } from "./sources/naver-search";
import { normalize } from "./normalizer";
import {
  NAVER_KEYWORDS,
  NAVER_DISPLAY_PER_KEYWORD,
  MIN_CONFIDENCE,
} from "./keywords";

export interface IngestionStats {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  keywordsProcessed: number;
  fetched: number;       // 네이버에서 가져온 총 건수
  duplicates: number;    // 이미 DB에 source_url 있는 것
  normalized: number;    // AI 정규화 성공
  filtered: number;      // AI가 "이벤트 아님" 또는 신뢰도 낮음으로 거름
  inserted: number;      // 실제 posts에 INSERT됨
  errors: number;
  errorMessages: string[];
}

async function isDuplicate(sourceUrl: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("posts")
    .select("id")
    .eq("source_url", sourceUrl)
    .maybeSingle();
  return Boolean(data);
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

  for (const keyword of NAVER_KEYWORDS) {
    let items;
    try {
      items = await searchBlog(keyword, NAVER_DISPLAY_PER_KEYWORD);
      stats.fetched += items.length;
      stats.keywordsProcessed++;
    } catch (e) {
      stats.errors++;
      stats.errorMessages.push(`naver "${keyword}": ${String(e)}`);
      continue;
    }

    for (const item of items) {
      try {
        if (await isDuplicate(item.link)) {
          stats.duplicates++;
          continue;
        }

        const norm = await normalize(item);
        if (!norm) {
          stats.errors++;
          continue;
        }

        if (!norm.is_actual_event || norm.confidence < MIN_CONFIDENCE) {
          stats.filtered++;
          continue;
        }

        stats.normalized++;

        const { error } = await supabaseServer.from("posts").insert({
          title: norm.title.slice(0, 120),
          brand_name: norm.brand_name,
          body: norm.body?.slice(0, 500) ?? null,
          source_url: item.link,
          kind: norm.kind,
          stage_categories: norm.stage_categories ?? [],
          type_tags: norm.type_tags ?? [],
          deadline: norm.deadline,
          status: "pending",
          source_type: "ingestion",
        });

        if (error) {
          stats.errors++;
          stats.errorMessages.push(`insert "${item.link}": ${error.message}`);
        } else {
          stats.inserted++;
        }
      } catch (e) {
        stats.errors++;
        stats.errorMessages.push(`item "${item.link}": ${String(e)}`);
      }
    }
  }

  const finishedAt = new Date();
  stats.finishedAt = finishedAt.toISOString();
  stats.durationMs = finishedAt.getTime() - startedAt.getTime();
  return stats;
}

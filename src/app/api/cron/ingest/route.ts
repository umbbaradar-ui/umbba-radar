// ============================================
// GET /api/cron/ingest — 자동 수집 cron 엔드포인트
// Vercel Cron이 매일 호출. 수동 트리거도 가능 (Bearer 토큰 필수)
// ============================================

import { NextResponse } from "next/server";
import { runIngestion } from "@/modules/ingestion/service";
import { expireOverduePosts } from "@/modules/curation/repository";

// Cron이 오래 걸려도 동작하도록 (Vercel Pro: 최대 300초, Hobby: 60초)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel Cron 또는 수동 트리거 검증
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let expiredCount = 0;
  try {
    // 1. 마감 지난 카드 자동 expired 처리
    expiredCount = await expireOverduePosts();
    console.log("[cron/ingest] expired:", expiredCount);
  } catch (e) {
    console.error("[cron/ingest] expire step failed:", e);
    // expire 실패해도 ingestion은 진행
  }

  // 2. 자동 수집 (네이버 + AI 정규화) — 현재 보류(PENDING)
  //    사유: Gemini API 키 정지(CONSUMER_SUSPENDED, project 991772519706)로 정규화가
  //    매일 0건 생산. 인스타 로컬 파이프라인(A·B루틴) 위주로 전환 (2026-05-31).
  //    되살리기: Vercel에 유효한 GEMINI_API_KEY + INGESTION_ENABLED=true 설정.
  //    (1번 마감 만료 처리 step은 계속 동작)
  if (process.env.INGESTION_ENABLED !== "true") {
    console.log(
      "[cron/ingest] ingestion paused (set INGESTION_ENABLED=true to enable)",
      { expired: expiredCount }
    );
    return NextResponse.json({ ok: true, paused: true, expired: expiredCount });
  }

  try {
    // 자동 수집 (네이버 + AI 정규화)
    const stats = await runIngestion();
    console.log("[cron/ingest] completed", { expired: expiredCount, ...stats });
    return NextResponse.json({ ok: true, expired: expiredCount, stats });
  } catch (e) {
    console.error("[cron/ingest] ingestion failed:", e);
    return NextResponse.json(
      { ok: false, expired: expiredCount, error: String(e) },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/cron/publish — 매시 5분 Vercel cron (R-20261105-3 1단계)
//
// 로직:
//   1. autoPublishReviewedPosts — 2차 검수 pass·85점+ pending 카드 자동 발행
//   2. expireOverduePosts — 마감 지난 카드 만료
//   3. advanceBdRun — 서버 새벽 수집 폴링·이어서 적재 (R-20261105-3 3단계, env 없으면 건너뜀)
//
// 정책:
//   - 발행 기준은 09:00 cron과 같은 함수를 그대로 쓴다(기준 변경 없음).
//   - 정지·맥 지연 뒤에도 다음 정각에 따라잡는다.
//   - 푸시·텔레그램 리포트는 보내지 않는다(09:00 notify-deadline 몫).
// ============================================

import { NextResponse } from "next/server";
import {
  autoPublishReviewedPosts,
  expireOverduePosts,
} from "@/modules/curation/repository";
import { advanceBdRun } from "@/modules/ingestion/bd-server";

const BD_BUDGET_MS = 200_000;

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 발행 실패해도 만료는 진행한다(ingest cron과 같은 best-effort).
  const autoPublish = await autoPublishReviewedPosts().catch((e) => {
    console.error("[cron/publish] auto-publish failed:", e);
    return { error: e instanceof Error ? e.message : String(e) };
  });

  let expired = 0;
  let expireError: string | undefined;
  try {
    expired = await expireOverduePosts();
  } catch (e) {
    expireError = e instanceof Error ? e.message : String(e);
    console.error("[cron/publish] expire failed:", e);
  }

  // 수집 적재 실패는 발행 결과와 분리한다 — 맥 폴백과 heartbeat가 따로 잡는다.
  const bdRun = await advanceBdRun(BD_BUDGET_MS).catch((e) => {
    console.error("[cron/publish] bd advance failed:", e);
    return { status: "error", detail: e instanceof Error ? e.message : String(e) };
  });

  console.log("[cron/publish]", JSON.stringify({ autoPublish, expired, expireError, bdRun }));
  const ok = !("error" in autoPublish && autoPublish.error) && !expireError;
  return NextResponse.json({ ok, autoPublish, expired, expireError, bdRun }, { status: ok ? 200 : 500 });
}

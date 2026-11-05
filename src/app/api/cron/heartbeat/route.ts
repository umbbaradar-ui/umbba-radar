// ============================================
// GET /api/cron/heartbeat — 매시 35분 Vercel cron (R-20261105-3 2단계)
//
// 정상이면 조용하다. 이상이면 기존 umbba 봇·방으로 원인과 할 일 한 줄.
// 판정 규칙은 heartbeat-rules.ts. 직전 상태는 events 테이블에 event_name='ops_heartbeat'
// 로 1행씩 남긴다(마이그레이션 없이 기존 테이블 재사용, 관리자 통계에서는 제외).
// ============================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import { autoPublishReviewedPosts } from "@/modules/curation/repository";
import {
  EMPTY_STATE,
  evaluateHeartbeat,
  kstHour,
  kstTodayStartIso,
  markSent,
  type HeartbeatState,
} from "@/modules/ingestion/heartbeat-rules";
import { sendTelegram } from "@/modules/ingestion/health-watchdog";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const EVENT_NAME = "ops_heartbeat";

async function loadState(): Promise<HeartbeatState> {
  const { data, error } = await supabaseServer
    .from("events")
    .select("properties")
    .eq("event_name", EVENT_NAME)
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(`state: ${error.message}`);
  const props = (data?.[0] as { properties?: Partial<HeartbeatState> } | undefined)?.properties;
  return {
    streak: props?.streak ?? {},
    lastSent: props?.lastSent ?? {},
    active: props?.active ?? [],
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const nowMs = Date.now();
  try {
    const prev = await loadState().catch((e) => {
      console.error("[cron/heartbeat]", e);
      return EMPTY_STATE;
    });

    const [ingestRes, draftRes] = await Promise.all([
      supabaseServer
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "ingestion")
        .gte("created_at", kstTodayStartIso(nowMs)),
      supabaseServer
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
    ]);
    if (ingestRes.error) throw new Error(`ingest: ${ingestRes.error.message}`);
    if (draftRes.error) throw new Error(`draft: ${draftRes.error.message}`);

    // 미리보기(execute=false) — 쓰기 0. 매시 5분 publish 뒤에도 남아 있으면 발행이 안 되는 것.
    const preview = await autoPublishReviewedPosts(false);

    const decision = evaluateHeartbeat(
      {
        nowMs,
        todayIngested: ingestRes.count ?? 0,
        draftBacklog: draftRes.count ?? 0,
        publishable: preview.enabled ? preview.published : 0,
        publishError: preview.error,
      },
      prev
    );

    let sent = false;
    if (decision.lines.length > 0) {
      sent = await sendTelegram(decision.lines.join("\n"));
    }
    const state = sent ? markSent(decision.state, decision.send, nowMs) : decision.state;

    const { error: saveErr } = await supabaseServer
      .from("events")
      .insert({ event_name: EVENT_NAME, properties: state });
    if (saveErr) console.error("[cron/heartbeat] state save failed:", saveErr.message);

    console.log(
      "[cron/heartbeat]",
      JSON.stringify({ active: state.active, send: decision.send, recovered: decision.recovered, sent })
    );
    return NextResponse.json({
      ok: true,
      active: state.active,
      send: decision.send,
      recovered: decision.recovered,
      sent,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron/heartbeat] failed:", message);
    // DB가 안 되면 상태도 못 읽는다 — 6시간 주기 시각에만 보내 반복을 막는다.
    if (kstHour(nowMs) % 6 === 0) {
      await sendTelegram(
        `🔴 <b>엄빠레이더 점검 실패</b> (${message.slice(0, 80)}) — 할 일: Supabase·Vercel Logs 확인`
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ============================================
// GET /api/cron/notify-deadline
// 매일 09:00 KST(=00:00 UTC) Vercel cron 호출.
//
// 로직:
//   1. 오늘 자정~내일 자정 KST 사이 마감되는 published 카드 찾기 (마감 D-1)
//   2. 그 카드에 status='interested' 표시한 user 목록 조회
//   3. 각 user의 push_subscriptions에 Web Push 발송
//
// 정책:
//   - 신규 매칭 카드는 푸시 X (인앱 알림만) — 자칫 자주 보내면 권한 박탈
//   - 관심 카드 마감만 푸시 (사용자가 직접 찜한 카드라 스팸 인식 거의 0)
//   - 카드별 tag → 같은 카드 알림 재발송 시 기존 알림 대체 (중복 방지)
// ============================================

import { NextResponse } from "next/server";
import { supabaseServer } from "@/shared/db/supabase-server";
import {
  getSubscriptionsForUsers,
  sendToMany,
  type PushPayload,
} from "@/modules/notification/push-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 인증
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // 1. KST 기준 "내일" 0시~24시 사이에 마감되는 카드
    const { fromIso, toIso } = getKstTomorrowRange();

    const { data: postsData, error: postsErr } = await supabaseServer
      .from("posts")
      .select("id, title, brand_name, deadline")
      .eq("status", "published")
      .gte("deadline", fromIso)
      .lt("deadline", toIso);

    if (postsErr) {
      console.error("[cron/notify-deadline] posts query failed:", postsErr);
      return NextResponse.json(
        { ok: false, error: postsErr.message },
        { status: 500 }
      );
    }

    const posts = (postsData ?? []) as Array<{
      id: string;
      title: string;
      brand_name: string | null;
      deadline: string;
    }>;

    if (posts.length === 0) {
      return NextResponse.json({ ok: true, posts: 0, sent: 0 });
    }

    // 2. 카드별 interested 사용자 모으기
    const postIds = posts.map((p) => p.id);
    const { data: statusData } = await supabaseServer
      .from("user_post_status")
      .select("user_id, post_id")
      .in("post_id", postIds)
      .eq("status", "interested");

    const statuses = (statusData ?? []) as Array<{
      user_id: string;
      post_id: string;
    }>;
    if (statuses.length === 0) {
      return NextResponse.json({ ok: true, posts: posts.length, sent: 0 });
    }

    // post_id → user_id[] 매핑
    const postToUsers = new Map<string, string[]>();
    for (const s of statuses) {
      const arr = postToUsers.get(s.post_id) ?? [];
      arr.push(s.user_id);
      postToUsers.set(s.post_id, arr);
    }

    // 3. 모든 관련 user의 구독을 한 번에 조회 (N+1 회피)
    const allUserIds = Array.from(
      new Set(statuses.map((s) => s.user_id))
    );
    const subs = await getSubscriptionsForUsers(allUserIds);

    // user_id → 구독 배열
    const userToSubs = new Map<string, typeof subs>();
    for (const s of subs) {
      const arr = userToSubs.get(s.user_id) ?? [];
      arr.push(s);
      userToSubs.set(s.user_id, arr);
    }

    // 4. 카드별로 push 발송
    let totalSent = 0;
    let totalGone = 0;
    let totalFailed = 0;
    let pushedPosts = 0;

    for (const post of posts) {
      const userIds = postToUsers.get(post.id) ?? [];
      const postSubs = userIds.flatMap((u) => userToSubs.get(u) ?? []);
      if (postSubs.length === 0) continue;

      const payload: PushPayload = {
        title: `내일 마감! ${post.brand_name ?? "관심 카드"}`,
        body: post.title,
        url: `/post/${post.id}`,
        tag: `deadline-${post.id}`,
      };

      const stats = await sendToMany(postSubs, payload);
      totalSent += stats.sent;
      totalGone += stats.gone;
      totalFailed += stats.failed;
      if (stats.sent > 0) pushedPosts++;
    }

    console.log("[cron/notify-deadline] done", {
      posts: posts.length,
      pushedPosts,
      sent: totalSent,
      gone: totalGone,
      failed: totalFailed,
    });

    return NextResponse.json({
      ok: true,
      posts: posts.length,
      pushedPosts,
      sent: totalSent,
      gone: totalGone,
      failed: totalFailed,
    });
  } catch (e) {
    console.error("[cron/notify-deadline] failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/**
 * KST 기준 "내일 0시 ~ 모레 0시" 구간을 UTC ISO로 반환.
 * 예: cron이 KST 09:00 (= UTC 00:00)에 돌면, 내일(D+1) 마감 카드 찾기.
 */
function getKstTomorrowRange(): { fromIso: string; toIso: string } {
  const now = new Date();
  // KST = UTC+9
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // 내일 0시 KST
  const tomorrowKst0 = new Date(
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate() + 1,
      0,
      0,
      0
    )
  );
  // KST 0시는 UTC -9시간 = 전날 15:00 UTC
  const fromUtc = new Date(tomorrowKst0.getTime() - 9 * 60 * 60 * 1000);
  const toUtc = new Date(fromUtc.getTime() + 24 * 60 * 60 * 1000);
  return {
    fromIso: fromUtc.toISOString(),
    toIso: toUtc.toISOString(),
  };
}

// ============================================
// POST /api/admin/health-report
// 밤샘 자동 루틴 "건강검진" 리포트를 텔레그램으로 전송.
// run-b.ps1이 B루틴 완료 직후 호출(Bearer ADMIN_CLI_TOKEN). 로컬 상태를 body로 전달.
//
// 로컬만 아는 정보(쿠키 나이·A스캔 401·B완주)는 run-b.ps1이 측정해 body로 보내고,
// 서버는 DB 통계(최근24h 수집·카드생성·승인대기)를 합쳐 종합 메시지를 만든다.
// TELEGRAM 미설정이면 no-op(200).
// ============================================

import { NextResponse } from "next/server";
import { getPipelineStats, getCounts } from "@/modules/curation/service";

export const dynamic = "force-dynamic";

interface HealthBody {
  // A스캔(밤샘) 로컬 측정값 — run-b.ps1이 scan-log.txt 분석해 전달
  scan?: {
    ok?: boolean; // 전반 성공 여부
    accounts?: number; // 마지막 회차 처리 계정 수
    fetched?: number; // fetch한 게시물 수
    queued?: number; // 큐 신규 추가 수
    failed?: number; // 실패(401 등) 계정 수
    all401?: boolean; // 전 계정 401 (쿠키 만료 강한 신호)
  };
  // B루틴 결과
  b?: {
    ok?: boolean;
    classified?: number;
    imported?: number;
    held?: number; // 사진 못 받아 보류된 수
  };
  // 인스타 쿠키 나이(일) — cookies.txt mtime 기준
  cookieAgeDays?: number;
}

async function handle(request: Request) {
  const auth = request.headers.get("authorization");
  if (
    !process.env.ADMIN_CLI_TOKEN ||
    auth !== `Bearer ${process.env.ADMIN_CLI_TOKEN}`
  ) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: HealthBody = {};
  try {
    body = (await request.json()) as HealthBody;
  } catch {
    // body 없어도 서버 통계만으로 리포트 (GET 테스트 등)
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: "TELEGRAM 미설정",
    });
  }

  const [pipeline, counts] = await Promise.all([
    getPipelineStats(),
    getCounts(),
  ]);
  const pending = counts.byStatus.pending;
  const todayKst = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  // ── 줄별 상태 판정 (🟢정상 / 🔴문제 / 🟡주의) ──
  const lines: string[] = [`🌅 <b>엄빠레이더 밤샘 리포트</b> (${todayKst})`, ``];

  // A스캔
  const s = body.scan;
  if (!s) {
    lines.push(`⚪ A스캔: 정보 없음 (로컬 측정값 미전달)`);
  } else if (s.all401) {
    lines.push(
      `🔴 <b>A스캔: 대부분 차단 — 인스타 인증 필요</b> (계정 인증/세션 풀어주세요)`
    );
  } else if (s.ok === false || (s.failed ?? 0) > 0) {
    lines.push(
      `🟡 A스캔: 일부 실패 (수집 ${s.queued ?? 0}건 / 실패 ${s.failed ?? 0}계정)`
    );
  } else {
    lines.push(
      `🟢 A스캔: 정상 (최근24h 수집 +${pipeline.last24h.found}건)`
    );
  }

  // B루틴
  const b = body.b;
  if (!b) {
    lines.push(`⚪ B루틴: 정보 없음`);
  } else if ((b.held ?? 0) > 0 && (b.imported ?? 0) === 0) {
    // 분류는 됐는데 이미지 다운로드가 전부 막힘 = 인스타 인증/세션 차단 (가장 흔한 케이스)
    lines.push(
      `🔴 <b>B루틴: 인스타 인증 필요</b> — 분류 ${b.classified ?? 0}건은 됐지만 사진을 못 받아 카드 0 (${b.held}건 대기).`
    );
    lines.push(
      `   👉 인스타 계정 인증을 풀어주세요. 풀면 밀린 큐부터 다음 새벽(또는 수동 실행)에 자동 재개됩니다.`
    );
  } else if (b.ok === false) {
    lines.push(`🔴 <b>B루틴: 실패/미완주</b> — 로그 확인 필요`);
  } else {
    const heldStr = (b.held ?? 0) > 0 ? ` / 사진보류 ${b.held}건` : "";
    lines.push(
      `🟢 B루틴: 정상 (분류 ${b.classified ?? 0} → 카드 +${pipeline.last24h.created}건${heldStr})`
    );
  }

  // 쿠키 나이
  const age = body.cookieAgeDays;
  if (typeof age === "number") {
    if (age >= 6) {
      lines.push(`🔴 인스타 쿠키: ${age}일 경과 — 곧 갱신하세요`);
    } else if (age >= 4) {
      lines.push(`🟡 인스타 쿠키: ${age}일 경과 (7일 전 갱신 권장)`);
    } else {
      lines.push(`🟢 인스타 쿠키: ${age}일 (양호)`);
    }
  }

  // 승인 대기
  lines.push(``);
  lines.push(
    pending > 0
      ? `✅ <b>승인 대기 ${pending}건</b> — 검수 필요`
      : `✅ 승인 대기 없음`
  );
  lines.push(``);
  lines.push(`👉 https://umbba-radar.com/admin/queue`);

  const text = lines.join("\n");

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    }
  );
  const data = (await tgRes.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
  };
  if (!tgRes.ok || !data.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Telegram API ${tgRes.status}: ${data.description ?? "전송 실패"}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}

export async function POST(request: Request) {
  return handle(request);
}
export async function GET(request: Request) {
  return handle(request);
}

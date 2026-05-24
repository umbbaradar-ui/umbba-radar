// ============================================
// AI 정규화 — Gemini Flash로 raw 데이터를 우리 카드 포맷으로 변환
// 무료 티어 일 1,500회 호출 (우리 사용량 50회/일 수준)
// ============================================

import "server-only";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

function ensureKey(): void {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY env var");
  }
}

export interface NormalizerInput {
  title: string;
  description: string;
  link: string;
  postdate: string; // YYYYMMDD
}

export type Kind = "recruiting" | "review" | "group_buy";
export type Stage =
  | "pregnancy"
  | "newborn"
  | "infant"
  | "toddler"
  | "preschool"
  | "elementary_lower"
  | "elementary_upper";
export type TypeTag =
  | "regram"
  | "lottery"
  | "free_trial"
  | "sponsored"
  | "gov_support";

export interface NormalizedPost {
  is_actual_event: boolean;
  confidence: number; // 0.0 ~ 1.0
  title: string;
  brand_name: string | null;
  body: string;
  kind: Kind;
  stage_categories: Stage[];
  type_tags: TypeTag[];
  deadline: string | null; // ISO 8601
}

const SYSTEM_PROMPT = `당신은 한국 육아 정보 큐레이션 사이트 "엄빠레이더"의 데이터 정규화 AI입니다.
블로그 글을 받아서, 부모에게 유용한 협찬·체험단·후기·공구 이벤트인지 판단하고 구조화된 JSON으로 반환합니다.

# 출력 JSON 스키마

{
  "is_actual_event": boolean,        // true: 실제 이벤트(모집·체험·공구·후기). false: 일반 정보·광고성·만료된 글
  "confidence": number,              // 0.0~1.0 위 판단의 신뢰도
  "title": string,                   // 깔끔한 한 줄 제목. 예: "○○ 분유 무료 샘플 신청"
  "brand_name": string | null,       // 브랜드명. 없으면 null
  "body": string,                    // 신청 방법 한 줄. 예: "인스타 댓글 + 친구 태그 → 30명 추첨"
  "kind": "recruiting" | "review" | "group_buy",
  "stage_categories": Array<"pregnancy"|"newborn"|"infant"|"toddler"|"preschool"|"elementary_lower"|"elementary_upper">,
  "type_tags": Array<"regram"|"lottery"|"free_trial"|"sponsored"|"gov_support">,
  "deadline": string | null          // ISO 8601 with +09:00. 없으면 null. 예: "2026-05-30T23:59:00+09:00"
}

# 분류 가이드

## kind
- recruiting: 신청·모집·체험단 모집 공고
- review: 사용 후기·리뷰 (단순 정보)
- group_buy: 공동구매·공구

## stage_categories (다중 선택)
- pregnancy: 임신중
- newborn: 출산 직후 (0~3개월)
- infant: 영아 (0~24개월)
- toddler: 유아 (2~4세)
- preschool: 유치원 (4~7세)
- elementary_lower: 초등 저학년
- elementary_upper: 초등 고학년

## type_tags (다중 선택)
- regram: 리그램·재게시 이벤트
- lottery: 추첨
- free_trial: 무료 체험·무료 샘플
- sponsored: 협찬·체험단 (브랜드가 비용 부담)
- gov_support: 정부지원 사업

# is_actual_event = false 인 경우
- "체험단 후기"라는 단순 사용 리뷰 (모집 정보 없음) → 단, 진짜 도움되는 후기면 review로 true
- 마감 지난 이벤트가 명확
- 광고성 글, SEO 스팸, 일반 정보
- 신청 방법·마감일 등 핵심 정보가 빠진 경우

# 한국어 출력 필수
title·body·brand_name 모두 한국어. JSON만 반환하세요 (다른 텍스트 X).`;

function buildUserPrompt(input: NormalizerInput): string {
  return `[입력 데이터]
제목: ${input.title}
본문 요약: ${input.description}
출처 URL: ${input.link}
게시일: ${input.postdate}

위 데이터를 분석해 JSON으로만 답하세요.`;
}

export async function normalize(
  input: NormalizerInput
): Promise<NormalizedPost | null> {
  ensureKey();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[normalize] Gemini API error ${res.status}: ${text}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[normalize] Gemini returned no text");
      return null;
    }
    const parsed = JSON.parse(text) as NormalizedPost;
    return parsed;
  } catch (e) {
    console.error("[normalize] failed:", e);
    return null;
  }
}

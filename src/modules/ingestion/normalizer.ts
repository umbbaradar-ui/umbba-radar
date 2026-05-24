// ============================================
// AI 정규화 — Gemini Flash로 raw 데이터 → 우리 카드 포맷
// 무료 티어 15 RPM 제한 대응: 배치 정규화 + 호출 사이 지연
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
  confidence: number;
  title: string;
  brand_name: string | null;
  body: string;
  kind: Kind;
  stage_categories: Stage[];
  type_tags: TypeTag[];
  deadline: string | null;
}

const SYSTEM_PROMPT = `당신은 한국 육아 정보 큐레이션 사이트 "엄빠레이더"의 데이터 정규화 AI입니다.
블로그 글 배열을 받아서, 부모에게 유용한 협찬·체험단·후기·공구 이벤트인지 판단하고 구조화된 JSON 배열로 반환합니다.

# 입력
{ "items": [{ id, title, description, link, postdate }, ...] }

# 출력 (JSON 배열로 정확히 입력 순서·개수 유지)
{
  "results": [
    {
      "id": number,                      // 입력 id 그대로
      "is_actual_event": boolean,         // 진짜 이벤트(모집/체험/공구/후기)면 true. 일반 정보·광고·만료 글이면 false
      "confidence": number,               // 0.0~1.0
      "title": string,                    // 깔끔한 한 줄 (예: "○○ 분유 무료 샘플 신청")
      "brand_name": string | null,
      "body": string,                     // 한 줄 요약 (예: "댓글 + 친구 태그 → 30명 추첨")
      "kind": "recruiting" | "review" | "group_buy",
      "stage_categories": Array<"pregnancy"|"newborn"|"infant"|"toddler"|"preschool"|"elementary_lower"|"elementary_upper">,
      "type_tags": Array<"regram"|"lottery"|"free_trial"|"sponsored"|"gov_support">,
      "deadline": string | null           // ISO 8601 with +09:00, 없으면 null
    },
    ...
  ]
}

# 분류
- recruiting: 신청·모집 공고
- review: 사용 후기 (유용한 정보 있어야 함)
- group_buy: 공동구매

# is_actual_event = false 인 경우
- 만료 지난 이벤트 명확
- 광고성 글·SEO 스팸
- 신청 방법·마감일 등 핵심 정보 없음
- 단순 정보 글

한국어 출력. JSON만 반환. 입력 개수와 동일한 배열 반환.`;

function buildUserPrompt(items: NormalizerInput[]): string {
  const itemsForPrompt = items.map((it, idx) => ({
    id: idx,
    title: it.title,
    description: it.description,
    link: it.link,
    postdate: it.postdate,
  }));
  return `[items]
${JSON.stringify(itemsForPrompt, null, 2)}

위 ${items.length}개 item 각각에 대해 결과 ${items.length}개를 JSON 배열로 반환하세요. 순서·개수 정확히 유지.`;
}

/** 배치 정규화 — 여러 아이템을 한 번의 Gemini 호출로 처리 (RPM 절약) */
export async function normalizeBatch(
  items: NormalizerInput[]
): Promise<(NormalizedPost | null)[]> {
  if (items.length === 0) return [];

  ensureKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(items) }] }],
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
      console.error(
        `[normalizeBatch] Gemini API error ${res.status}: ${text.slice(0, 500)}`
      );
      return items.map(() => null);
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[normalizeBatch] Gemini returned no text");
      return items.map(() => null);
    }
    const parsed = JSON.parse(text) as { results?: Array<NormalizedPost & { id?: number }> };
    if (!parsed.results || !Array.isArray(parsed.results)) {
      console.error("[normalizeBatch] No results array in response");
      return items.map(() => null);
    }
    // 순서·개수 맞춰 정렬
    const output: (NormalizedPost | null)[] = items.map(() => null);
    for (const r of parsed.results) {
      if (typeof r.id === "number" && r.id >= 0 && r.id < items.length) {
        output[r.id] = r as NormalizedPost;
      }
    }
    return output;
  } catch (e) {
    console.error("[normalizeBatch] failed:", e);
    return items.map(() => null);
  }
}

/** 단일 정규화 (편의 함수, 내부적으로 배치 호출) */
export async function normalize(
  input: NormalizerInput
): Promise<NormalizedPost | null> {
  const [result] = await normalizeBatch([input]);
  return result;
}

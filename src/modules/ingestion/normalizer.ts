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

export type Kind = "recruiting" | "group_buy";
export type Stage =
  | "pregnancy"
  | "newborn"
  | "infant"
  | "toddler"
  | "elementary"
  | "all_ages";
export type TypeTag =
  | "regram"
  | "experience"
  | "kids_model"
  | "supporters"
  | "form";
export type Topic = "parenting" | "living";

export interface NormalizedPost {
  is_actual_event: boolean;
  confidence: number;
  title: string;
  brand_name: string | null;
  body: string;
  /** 검색 매칭용 동의어·유사어 (콤마 구분, 1~3개). 예: "기저귀,팬티" */
  search_keywords: string | null;
  kind: Kind;
  stage_categories: Stage[];
  type_tags: TypeTag[];
  topic: Topic;
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
      "search_keywords": string | null,   // 동의어·유사어 콤마 구분 1~3개 (아래 가이드 참조)
      "kind": "recruiting" | "group_buy",
      "stage_categories": Array<"pregnancy"|"newborn"|"infant"|"toddler"|"elementary"|"all_ages">,
      "type_tags": Array<"regram"|"experience"|"kids_model"|"supporters"|"form">,
      "topic": "parenting" | "living",     // 콘텐츠 주제 (필수, 둘 중 하나)
      "deadline": string | null           // ISO 8601 with +09:00, 없으면 null
    },
    ...
  ]
}

# 분류
- recruiting: 신청·모집 공고 (대부분 이걸로 — 후기·체험단·이벤트 모두 recruiting)
- group_buy: 공동구매 ("공구"·"공동구매" 명시된 경우만)
※ review 옵션 제거. 후기형도 recruiting으로 통일.

# stage_categories (시기, 복수 선택 가능)
- pregnancy: 임신중
- newborn: 신생아 (~3개월)
- infant: 영아 (~12개월)
- toddler: 유아 (1~7세, 유치원 포함)
- elementary: 초등생 (8~13세)
- all_ages: 전연령 (특정 시기 무관, 식탁세트·청소기·가전 등 가족 단위 제품. 시기 명확하지 않으면 이걸 단독 선택)

# type_tags (참여 방식·이벤트 유형, 복수 선택 가능, 해당 없으면 빈 배열)
- regram: 본인 피드에 리그램(재게시)해야 참여 — "필수 리그램"이라고 명시된 경우만
- experience: 체험단 — 제품/서비스 받고 후기 작성·SNS 게시 의무 있음 (무료체험·협찬·체험단 모두 포함)
- kids_model: 키즈모델·아동 모델 — 아이가 화보·광고 촬영에 참여
- supporters: 서포터즈 — 장기 SNS 활동(주 N회 게시 등) 약속하고 제품/혜택 받음
- form: 별도 폼 작성 필수 — "구글폼/네이버폼/자체 신청서/카카오톡 채널 신청서" 등 외부 폼 URL 작성을 거쳐야 신청 완료되는 경우. 댓글·DM만으로 신청 가능하면 form 아님
※ form은 다른 태그와 직교적이라 자유롭게 조합 가능 (예: experience + form, supporters + form)
※ "팔로우만", "추첨 방식", "정부 지원사업"은 type_tags에 포함하지 마세요 (분류 의미 없음)

# topic (콘텐츠 주제, 필수 — 둘 중 하나)
- parenting: 부모-자녀 활동·아동 관련 (이유식·기저귀·완구·교구·키즈모델·체험단 등 아이가 주체이거나 직접 사용)
- living: 가전·가구·식기·청소·생활용품 (가족 단위 사용이지만 아이가 주체 아님 — 식탁, 공기청정기, 침구, 청소기 등)
※ 애매하면 parenting을 선택 (육아 사이트 디폴트)

# search_keywords (검색 동의어·유사어, 콤마 구분 1~3개)
사용자가 다른 표현으로 검색해도 이 카드가 잡히게 하는 보조 키워드.
제목·본문에 이미 있는 단어는 중복으로 넣지 마세요 (어차피 잡힘).
예시:
- 카드: "기저귀 팬티 체험단" → search_keywords: null (이미 본문에 다 있음)
- 카드: "팬티 체험단" → search_keywords: "기저귀,기저귀팬티"
- 카드: "분유 샘플" → search_keywords: "이유식,수유용품"
- 카드: "유모차 협찬" → search_keywords: "유모차세트,스트롤러"
- 카드: "조리원 후기" → search_keywords: "산후조리원,산후도우미"
- 카드: "초등 학습지" → search_keywords: "방문학습,학습지구독"
동의어가 떠오르지 않으면 null. 억지 채우지 말 것.

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

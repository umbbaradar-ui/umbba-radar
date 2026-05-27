// ============================================
// Vision 기반 이미지 추출기 (Claude / Gemini 양쪽 지원)
// VISION_PROVIDER env 로 분기:
//   - "claude" (기본): Anthropic Claude Sonnet 4.5 Vision 사용
//   - "gemini": Google Gemini 2.0 Flash 사용
// 인스타·블로그 스크린샷·OG 이미지에서 카드 메타데이터 자동 추출
// HEIC 는 Claude 미지원 (Gemini만 지원) — 인스타 OG는 JPG라 실무상 문제 없음
// ============================================

import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const VISION_PROVIDER = (process.env.VISION_PROVIDER ?? "claude").toLowerCase();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_VISION_MODEL ?? "claude-sonnet-4-5";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY env var is not configured. Set it in .env.local and Vercel."
    );
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export interface VisionExtractResult {
  is_actual_event: boolean;
  confidence: number;
  title: string;
  brand_name: string | null;
  body: string;
  /** 검색 매칭용 동의어·유사어 (콤마 구분, 1~3개) */
  search_keywords: string | null;
  kind: "recruiting" | "group_buy";
  stage_categories: string[];
  type_tags: string[];
  topic: "parenting" | "living";
  deadline: string | null;
}

const VISION_SYSTEM_PROMPT = `당신은 한국 육아 정보 큐레이션 사이트 "엄빠레이더"의 이미지 분석 AI입니다.
인스타그램·블로그에서 가져온 협찬·체험단·후기 이미지를 보고 구조화된 정보를 추출해주세요.

이미지에서 다음을 모두 활용해 추출:
- 이미지 안의 텍스트 (제품명, 이벤트명, 신청 방법, 마감일 등)
- 시각적 정보 (제품 종류, 브랜드 로고, 인물 등)
- 분위기·맥락 (모집 공고인지, 후기인지)

# 출력 JSON
{
  "is_actual_event": boolean,               // 실제 이벤트(모집/체험/공구/후기)면 true
  "confidence": number,                     // 0.0~1.0
  "title": string,                          // 깔끔한 한 줄 (예: "○○ 분유 무료 샘플 신청")
  "brand_name": string | null,              // 브랜드명. 명확히 보이는 경우만, 아니면 null
  "body": string,                           // 한 줄 요약 (예: "댓글 + 친구 태그 → 30명 추첨")
  "search_keywords": string | null,         // 동의어·유사어 콤마 구분 1~3개 (아래 가이드 참조)
  "kind": "recruiting" | "group_buy",
  "stage_categories": Array<"pregnancy"|"newborn"|"infant"|"toddler"|"elementary"|"all_ages">,
  "type_tags": Array<"regram"|"experience"|"kids_model"|"supporters"|"form">,
  "topic": "parenting" | "living",          // 콘텐츠 주제 (필수)
  "deadline": string | null                 // ISO 8601 with +09:00. 명확히 적혀있을 때만, 아니면 null
}

# kind 분류
- recruiting: 신청·모집 공고 (대부분 이걸로 분류 — 후기·체험단·이벤트 모두 모집중으로)
- group_buy: 공동구매 (드물게, "공구" "공동구매" 명시된 경우만)
※ review 옵션은 제거. 후기형 게시물도 recruiting으로 분류.

# type_tags (복수 선택 가능, 해당 없으면 빈 배열)
- regram: 본인 피드에 리그램(재게시) 필수로 명시된 경우만
- experience: 체험단 — 제품/서비스 받고 후기·SNS 게시 의무 있음 (무료체험·협찬·체험단 모두 통합)
- kids_model: 키즈모델·아동 모델 — 아이가 화보·광고 촬영 참여
- supporters: 서포터즈 — 장기 SNS 활동(주 N회 게시 등) 약속하고 제품/혜택 수령
- form: 별도 폼 작성 필수 — "구글폼/네이버폼/자체 신청서/카카오톡 채널 신청서" 등 외부 폼 URL 작성을 거쳐야 신청 완료되는 경우. 댓글·DM만으로 신청 가능하면 form 아님
※ form은 다른 태그와 직교적이라 자유롭게 조합 가능 (예: experience + form)
※ "팔로우만", "추첨 방식", "정부 지원사업"은 type_tags에 포함하지 마세요 (분류 의미 없음)

# topic (콘텐츠 주제, 필수 — 둘 중 하나)
- parenting: 아이가 주체이거나 직접 사용 (이유식·기저귀·완구·교구·키즈모델·아동 체험단 등)
- living: 가전·가구·식기·청소용품·침구 등 살림 (아이용 아닌 가족 단위)
※ 애매하면 parenting (육아 사이트 디폴트)

# search_keywords (검색 동의어·유사어, 콤마 구분 1~3개)
사용자가 다른 표현으로 검색해도 이 카드가 잡히게 하는 보조 키워드.
제목·본문에 이미 있는 단어는 중복 X. 동의어 안 떠오르면 null.
예시:
- "팬티 체험단" → "기저귀,기저귀팬티"
- "분유 샘플" → "이유식,수유용품"
- "조리원" → "산후조리원,산후도우미"
- "유모차" → "스트롤러,유모차세트"

# stage_categories
- pregnancy: 임신중
- newborn: 신생아 (~3개월)
- infant: 영아 (~12개월)
- toddler: 유아 (1~7세, 유치원 포함)
- elementary: 초등생 (8~13세)
- all_ages: 전연령 (특정 시기 무관, 식탁세트·청소기·가전·식품 등 가족 단위 제품. 이미지에서 시기 단서가 없으면 이걸 단독 선택)

한국어 출력. JSON만 반환. 마크다운 백틱 금지.`;

/**
 * 모델 응답 텍스트 → JSON 파싱 (마크다운 ```json 감싸짐 대응)
 */
function parseVisionJson(text: string): VisionExtractResult | null {
  let body = text.trim();
  // ```json ... ``` 형태로 감싸진 경우 제거
  if (body.startsWith("```")) {
    body = body
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  try {
    return JSON.parse(body) as VisionExtractResult;
  } catch (err) {
    console.error(
      "[vision-extractor] JSON parse failed:",
      err,
      "raw:",
      text.slice(0, 200)
    );
    return null;
  }
}

/**
 * Gemini Vision 분기
 * HEIC, HEIF, JPEG, PNG, WEBP 모두 직접 지원
 */
async function extractFromImageBytesGemini(
  imageBytes: Uint8Array,
  mimeType: string
): Promise<VisionExtractResult | null> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY env var is not configured. Set it in .env.local and Vercel."
    );
  }

  const base64 = Buffer.from(imageBytes).toString("base64");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          { text: "이 이미지를 분석해 구조화된 JSON으로 정보를 반환해주세요." },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[vision-extractor] Gemini error:", res.status, errText);
      return null;
    }
    const json = await res.json();
    const text: string | undefined =
      json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error(
        "[vision-extractor] No text in Gemini response:",
        JSON.stringify(json).slice(0, 200)
      );
      return null;
    }
    return parseVisionJson(text);
  } catch (err) {
    console.error("[vision-extractor] Gemini failed:", err);
    return null;
  }
}

/**
 * Claude Vision 분기
 * 지원 MIME: image/jpeg, image/png, image/gif, image/webp
 * HEIC/HEIF는 미지원이라 caller 쪽에서 변환하거나 Gemini로 fallback 필요
 */
async function extractFromImageBytesClaude(
  imageBytes: Uint8Array,
  mimeType: string
): Promise<VisionExtractResult | null> {
  const client = getAnthropic();

  // Claude가 지원하는 MIME 타입으로 정규화
  const SUPPORTED_CLAUDE_MIMES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ]);
  const mediaType = SUPPORTED_CLAUDE_MIMES.has(mimeType)
    ? (mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
    : "image/jpeg"; // 대부분 인스타 OG는 jpeg

  const base64 = Buffer.from(imageBytes).toString("base64");

  try {
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "이 이미지를 분석해 구조화된 JSON으로 정보를 반환해주세요. 마크다운 백틱 없이 JSON만.",
            },
          ],
        },
      ],
    });

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error(
        "[vision-extractor] Claude returned no text block:",
        JSON.stringify(msg.content).slice(0, 200)
      );
      return null;
    }
    return parseVisionJson(textBlock.text);
  } catch (err) {
    console.error("[vision-extractor] Claude failed:", err);
    return null;
  }
}

/**
 * 이미지 바이트 + MIME → 구조화 결과
 * VISION_PROVIDER env 로 Claude / Gemini 선택 (기본 claude)
 */
export async function extractFromImageBytes(
  imageBytes: Uint8Array,
  mimeType: string
): Promise<VisionExtractResult | null> {
  if (VISION_PROVIDER === "gemini") {
    return extractFromImageBytesGemini(imageBytes, mimeType);
  }
  return extractFromImageBytesClaude(imageBytes, mimeType);
}

interface UrlExtractOutput {
  result: VisionExtractResult | null;
  imageBytes: Uint8Array | null;
  imageMime: string | null;
  error?: string;
}

/**
 * URL → og:image 추출 → 이미지 다운로드 → Vision 분석
 * 인스타 공개 포스트의 OG 메타 태그를 활용 (TOS 회색지대지만 일반 링크 프리뷰와 동일 수준)
 */
export async function extractFromUrl(targetUrl: string): Promise<UrlExtractOutput> {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) {
      return {
        result: null,
        imageBytes: null,
        imageMime: null,
        error: `URL fetch 실패 (${res.status}). 인스타가 로그인 벽을 띄웠을 수 있어요.`,
      };
    }
    const html = await res.text();

    // og:image 메타 태그 추출 (속성 순서 양쪽 케이스 다 대응)
    const ogImageMatch =
      html.match(
        /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i
      );

    const ogImage = ogImageMatch?.[1];
    if (!ogImage) {
      return {
        result: null,
        imageBytes: null,
        imageMime: null,
        error:
          "og:image 메타 태그를 찾을 수 없어요. 비공개 포스트거나 인스타가 차단했을 수 있어요. 스크린샷 업로드를 사용해주세요.",
      };
    }

    // 이미지 다운로드
    const imageRes = await fetch(ogImage);
    if (!imageRes.ok) {
      return {
        result: null,
        imageBytes: null,
        imageMime: null,
        error: `이미지 다운로드 실패 (${imageRes.status})`,
      };
    }
    const buffer = await imageRes.arrayBuffer();
    const imageBytes = new Uint8Array(buffer);
    const imageMime =
      imageRes.headers.get("content-type")?.split(";")[0].trim() ||
      "image/jpeg";

    // Vision 분석
    const result = await extractFromImageBytes(imageBytes, imageMime);

    return { result, imageBytes, imageMime };
  } catch (err) {
    console.error("[extractFromUrl] failed:", err);
    return {
      result: null,
      imageBytes: null,
      imageMime: null,
      error: `네트워크 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

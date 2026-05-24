// ============================================
// Gemini Vision 기반 이미지 추출기
// 인스타·블로그 스크린샷·OG 이미지에서 카드 메타데이터 자동 추출
// HEIC·JPG·PNG·WEBP 모두 Gemini가 직접 처리 (별도 변환 불필요)
// ============================================

import "server-only";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";

export interface VisionExtractResult {
  is_actual_event: boolean;
  confidence: number;
  title: string;
  brand_name: string | null;
  body: string;
  kind: "recruiting" | "review" | "group_buy";
  stage_categories: string[];
  type_tags: string[];
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
  "kind": "recruiting" | "review" | "group_buy",
  "stage_categories": Array<"pregnancy"|"newborn"|"infant"|"toddler"|"preschool"|"elementary_lower"|"elementary_upper"|"all_ages">,
  "type_tags": Array<"follow"|"regram"|"lottery"|"free_trial"|"experience_group"|"sponsored"|"gov_support">,
  "deadline": string | null                 // ISO 8601 with +09:00. 명확히 적혀있을 때만, 아니면 null
}

# kind 분류
- recruiting: 신청·모집 공고
- review: 사용 후기 (유용한 정보 있어야 함)
- group_buy: 공동구매

# type_tags (복수 선택 가능)
- follow: 계정 팔로우만으로 참여 (가장 가벼운 진입)
- regram: 본인 피드에 리그램 필요
- lottery: 추첨/뽑기 형식
- free_trial: 무료 샘플·체험 제품 제공
- experience_group: 체험단 (후기 의무)
- sponsored: 협찬 (광고성 표시 의무)
- gov_support: 정부·지자체 지원

# stage_categories
- pregnancy: 임신중
- newborn: 출산 직후 (~3개월)
- infant: 영아 (~12개월)
- toddler: 유아 (1~5세)
- preschool: 유치원
- elementary_lower: 초등 저학년
- elementary_upper: 초등 고학년
- all_ages: 전연령 (특정 시기 무관, 식탁세트·청소기·가전·식품 등 가족 단위 제품. 이미지에서 시기 단서가 없으면 이걸 단독 선택)

한국어 출력. JSON만 반환. 마크다운 백틱 금지.`;

/**
 * 이미지 바이트 + MIME → 구조화 결과
 * Gemini는 HEIC, HEIF, JPEG, PNG, WEBP 모두 직접 지원
 */
export async function extractFromImageBytes(
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
      console.error("[vision-extractor] No text in response:", JSON.stringify(json).slice(0, 200));
      return null;
    }
    return JSON.parse(text) as VisionExtractResult;
  } catch (err) {
    console.error("[vision-extractor] failed:", err);
    return null;
  }
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

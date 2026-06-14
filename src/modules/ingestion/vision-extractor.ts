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
import { safeFetchText, safeFetchBytes } from "@/shared/utils/safe-fetch";

// og:image 다운로드 최대 크기 (SSRF/리소스 고갈 방지)
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

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

const VISION_SYSTEM_PROMPT = `당신은 한국 육아 정보 큐레이션 사이트 "엄빠레이더"의 컨텐츠 분석 AI입니다.
인스타그램에서 가져온 협찬·체험단·후기 게시물을 보고 구조화된 정보를 추출해주세요.

# 정보원 우선순위 (중요)
**사용자 메시지에 "[캡션]" 본문이 포함되어 있으면 그게 1차 정보원입니다.**
1. **캡션 본문 (최우선)**: 정확한 제품명·브랜드명·마감일·시기·신청 방법이 글로 명시되어 있음
2. **이미지 안의 텍스트** (보조): OCR 한계로 오타 가능, 캡션과 충돌하면 캡션 신뢰
3. **이미지 시각 정보** (보조): 제품 종류·연령대·분위기 단서

캡션이 짧거나 정보 부족할 때만 이미지에 의존하세요.
캡션에 명시된 제품명·브랜드명·날짜는 절대 이미지 OCR 으로 덮어쓰지 마세요.

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
  "deadline": string | null                 // ISO 8601 with +09:00. 캡션에서 적극 추출, 없으면 null
}

# deadline 추출 (캡션 본문 우선 적극 탐색)
캡션에 자주 나오는 패턴:
- "~까지", "마감: X월 Y일", "X월 Y일(요일) 자정", "X/Y 23:59", "선착순 N명 (~ 마감)"
- "이번 주 일요일까지" → 게시일 기준 가장 가까운 일요일 23:59 KST 로 변환
- "오늘부터 7일간", "1주일간" → 게시일 + 해당 기간
- "당첨자 발표 X월 Y일" → 발표일 직전 또는 별도 추출 가능
- 명시 없으면 null (자동으로 deadline_unknown 처리됨)

# 제목 작성 규칙 (가장 중요 — 캡션 우선)
- **캡션에 명시된 핵심 제품·이벤트명을 그대로** 사용. 추측·요약 X.
  - 좋은 예: "예비맘의 첫 병 이벤트" 캡션에 "신생아 젖병 2종 증정" 명시 → 제목: "신생아 젖병 2종 증정"
  - 좋은 예: "콜라보 제품 증정" 캡션에 "만능 멀티 티슈 100매" 명시 → 제목: "만능 멀티 티슈 증정"
  - 나쁜 예: 이미지의 헤드라인만 보고 "콜라보 제품 증정" 으로 끝냄 (제품 정체 누락)
- 끝맺음: "신청", "모집", "증정", "체험단 모집", "후기 모집" 같은 명사구로 종결
- 마케팅 수사 ("최고", "절대 놓치지 마세요") 제거하고 사실만
- 이모지·해시태그·마침표·물음표·느낌표 금지
- 50자 이내 권장 (모바일 카드 한 줄)

# brand_name 표기 규칙 (캡션 우선·한글 우선)
- **캡션에 @brand 또는 #브랜드 또는 본문 텍스트에 명시된 브랜드명을 그대로** 한글로
- 이미지 OCR 만으로 추측 X (오타 위험: "순수아" → "순수다" 같은 OCR 오류 방지)
- 한글 표기: "BEBERO" → "베베로", "Kakao" → "카카오", "Pampers" → "팸퍼스"
- 예외 (알파벳 약자 보편): LG, SK, GS, CJ, CU, NH, KB 등 영문 유지
- 한글 옆 영문 병기 X (예: "베베로 (BEBERO)" 금지)
- 캡션·이미지 어디에도 브랜드 단서 없으면 null (추측보다 빈값이 나음)

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

# stage_categories (캡션에서 시기 단서 적극 추출)
- pregnancy: 임신중 — 산모·임산부·예비맘·태교·산후조리원
- newborn: 신생아 0~3개월 — 신생아·산후·조리원·배냇·모빌·젖병(첫 단계)·분유(1단계)
- infant: 영아 4~12개월 — 이유식·기저귀·옹알이·뒤집기·앉기·이가 나기·치발기·범퍼침대
- toddler: 유아 1~7세 — 유치원·어린이집·식판·키즈카페·교구·동화책·말 트이기·배변훈련
- elementary: 초등생 8~13세 — 초등학교·학용품·방과후·습관 만들기
- all_ages: 전연령 — 식기·청소기·가전·식품·살림용품 등 **시기 무관 가족 단위 제품에만** 사용

**시기 분류 룰 (중요)**:
- 이유식·젖꼭지·치발기·기저귀 같은 키워드는 **절대 all_ages 단독 X** → 해당 시기 명시
- 캡션에 "0~3개월", "백일 아기", "신생아용" 같은 직접 표현 있으면 그대로 매칭
- 캡션에 시기 단서 없어도 제품 종류로 추론 가능하면 추론 (예: "이유식 큐브" → infant + toddler)
- 정말 어른·가족 단위(공기청정기, 식기세트)일 때만 all_ages

**시기 안전 마진 (애매하면 더 넓게)**:
- 베개·매트·잠자리 → newborn + infant + toddler
- 선크림·자외선차단 → infant + toddler + elementary
- 젖병·분유 → newborn + infant
- 모델 모집 (걷기 전) → newborn + infant
- 아동복 → 명확하면 그것만, 모호하면 newborn + infant + toddler

# ⚠️ skip 판단 — is_actual_event = false 로 표시 (사용자 검수 X, AI 가 결정)

다음 패턴은 **is_actual_event: false, confidence: 0.0~0.3** 로 반환 (카드 생성 안 됨):

1. **이벤트 기간 만료** — 캡션의 마감일이 게시일+30일 이상 전이면 만료 추정
2. **신청 방법 없음** — 캡션에 "참여 방법·신청·응모·모집·댓글·팔로우" 패턴 없으면 광고
3. **단순 광고·자랑·후기** — "새 상품 출시", "리뉴얼 오픈", 인플루언서 협찬 후기
4. **매장 영업 안내** — 영업 시간·휴무·매장 오픈 알림
5. **정치·종교·논란성**
6. **무관 콜라보 알림** — "다른 브랜드와 콜라보" 만 있고 모집 X
7. **LIVE 방송 안내** — "오늘 9시 라이브", "LIVE 진행" 시청 권유 (단, "라이브 시청+댓글 → 추첨" 명확한 응모는 분류)
8. **기존 구매자·사용자 대상** — "○○로 만든 사진 보내주세요", "○○ 사용하는 모습", "구매하신 분 후기 모집" (신규에 무관)

# body 작성 — **원문 그대로 (요약 금지)**

캡션의 핵심 정보를 풍부하게 보존:
- 이벤트 기간 (•이벤트 기간 : 5/27(수)-5/31(일))
- 참여 방법 (단계별 그대로)
- 증정 내용·인원
- 당첨자 발표 시기·방법
- 추가 조건 (스토리 공유 UP, 비공개 계정 제외 등)
- 줄바꿈·불릿(•, -) 보존
- 해시태그(#가든데이즈) 제거 — 본문 노이즈

나쁜 예: "댓글 + 친구 태그 → 30명 추첨" (정보 손실)
좋은 예:
"•이벤트 기간 : 5/27(수)-5/31(일)
•참여방법
- 베베로 팔로우
- 댓글 + 친구 태그
•증정: 후르츠 딸기 옷 SS 세트 (3명)
•당첨자 발표 : 6/2(화) DM"

2000자까지. 짧으면 그대로, 길면 핵심만 살려 풀로.

# title 에 brand_name 절대 X
PostCard 가 brand_name 별도 표시. title 에 또 넣으면 중복.
나쁜 예: "베베로 후르츠 딸기 증정"
좋은 예: "후르츠 딸기 증정"

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

/** caption 이 있으면 user message 에 prefix 로 붙일 텍스트 */
function buildUserPrompt(caption: string | null | undefined): string {
  const trimmed = caption?.trim();
  if (!trimmed) {
    return "캡션을 못 받았어요. 이미지만 보고 분석해 구조화된 JSON으로 정보를 반환해주세요. 마크다운 백틱 없이 JSON만.";
  }
  // 캡션이 너무 길면 token 절약 위해 자름 (2000자 = 약 1000 tokens)
  const capped = trimmed.length > 2000 ? trimmed.slice(0, 2000) + "…" : trimmed;
  return (
    `다음 인스타그램 게시물의 [캡션] 본문이에요. ` +
    `**캡션이 1차 정보원**이고 이미지는 보조입니다. ` +
    `캡션의 제품명·브랜드명·마감일·시기 단서를 적극 활용해서 ` +
    `구조화된 JSON 으로 반환해주세요. 마크다운 백틱 없이 JSON만.\n\n` +
    `[캡션]\n${capped}`
  );
}

/**
 * Gemini Vision 분기
 * HEIC, HEIF, JPEG, PNG, WEBP 모두 직접 지원
 */
async function extractFromImageBytesGemini(
  imageBytes: Uint8Array,
  mimeType: string,
  caption: string | null | undefined
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
          { text: buildUserPrompt(caption) },
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
  mimeType: string,
  caption: string | null | undefined
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
      // ephemeral cache_control → 5분 TTL 안에서 동일 system prompt 재사용 시
      // cached input price 90% 할인 (Claude Sonnet 기준 $3 → $0.30/1M).
      // CLI 가 배치 5개를 연속 호출하면 1번째만 정가, 2~5번째는 cache hit.
      system: [
        {
          type: "text",
          text: VISION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
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
              text: buildUserPrompt(caption),
            },
          ],
        },
      ],
    });

    // 토큰 사용량 로깅 (캐시 hit 확인용)
    const u = msg.usage;
    console.log(
      `[vision-extractor] Claude tokens: input=${u.input_tokens} ` +
        `cache_create=${u.cache_creation_input_tokens ?? 0} ` +
        `cache_read=${u.cache_read_input_tokens ?? 0} ` +
        `output=${u.output_tokens}`
    );

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
 * 이미지 바이트 + MIME (+ 선택적 캡션) → 구조화 결과
 * VISION_PROVIDER env 로 Claude / Gemini 선택 (기본 claude)
 *
 * caption 이 주어지면 1차 정보원으로 활용 (이미지보다 우선) — 정확도 대폭 향상.
 * CLI 가 gallery-dl 로 받은 인스타 캡션을 그대로 넘기는 게 권장.
 */
export async function extractFromImageBytes(
  imageBytes: Uint8Array,
  mimeType: string,
  caption?: string | null
): Promise<VisionExtractResult | null> {
  if (VISION_PROVIDER === "gemini") {
    return extractFromImageBytesGemini(imageBytes, mimeType, caption);
  }
  return extractFromImageBytesClaude(imageBytes, mimeType, caption);
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
    // SSRF 방지: 사설/내부 주소 차단 + hop 재검증 + 타임아웃(헤더+본문) — safeFetchText
    const res = await safeFetchText(
      targetUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        },
      },
      { timeoutMs: 8000 }
    );
    if (!res.ok) {
      return {
        result: null,
        imageBytes: null,
        imageMime: null,
        error: `URL fetch 실패 (${res.status}). 인스타가 로그인 벽을 띄웠을 수 있어요.`,
      };
    }
    const html = res.text;

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

    // 이미지 다운로드 — og:image도 상대경로 가능성 있어 절대화 후 SSRF 검증.
    // 타임아웃·8MB 크기상한(스트리밍)은 safeFetchBytes 내부에서 처리.
    const ogImageAbs = new URL(ogImage, targetUrl).toString();
    const imageRes = await safeFetchBytes(
      ogImageAbs,
      {},
      { timeoutMs: 8000 },
      MAX_IMAGE_BYTES
    );
    if (!imageRes.ok) {
      return {
        result: null,
        imageBytes: null,
        imageMime: null,
        error: `이미지 다운로드 실패 (${imageRes.status})`,
      };
    }
    const imageBytes = imageRes.bytes;
    const imageMime = imageRes.contentType || "image/jpeg";

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

// ============================================
// 광고·제휴 고지 문구 — 정본 한 곳 (C283)
//
// /about/partners(광고·제휴 안내)와 개인정보처리방침이 이 파일만 읽는다.
// 가이드 체크 카드(GuideAffiliateCard)의 '광고' 배지·고지 문구도 같은 문장이어야 한다.
//   - 카드 쪽 정본: affiliate.ts PARTNER_COPY(링크 단계 패치 0005). 링크 넣기 전에
//     work 30-umbba/엄빠레이더/수익화/패치-제휴고지/check_disclosure_sync.py 로 두 파일 문장이
//     글자 하나까지 같은지 검사한다(다르면 실패). 한쪽을 고치면 다른 쪽도 같이 고친다.
//
// 근거: 공정위 「추천·보증 등에 관한 표시·광고 심사지침」(2026-06-01 시행 개정분)과
//   공정위 안내서 「Q&A로 알아보는 경제적 이해관계 표시」(2025-12-02 개정 배포)의 4원칙
//   ①표시 위치의 접근성 ②표현 형태의 인식가능성 ③표시 내용의 명확성 ④사용 언어의 동일성.
//   - 안내서 p13: '추천·보증의 내용과 함께' 표시, '더보기'를 눌러야 보이거나 '링크로 연결되는 페이지'는
//     적절한 위치가 아니다 → 이 안내 페이지는 보충 설명이고, 고지 자체는 카드 맨 위(링크 바로 위)에 항상 보인다.
//   - 안내서 p20~21: '광고'·'유료광고' 등 명확한 표현. '파트너스'·'정보/홍보성 글' 등은 부적절.
//   - 안내서 p22: 'AD'·'Sponsor'·'PR' 등 외국 문자는 동일한 언어가 아니다 → 배지는 한국어 '광고'.
//   원문 대조 기록: work 30-umbba/엄빠레이더/개발/시기가이드/원고/sponsorship-disclosure.md 주석 블록.
//
// 링크 0개(체크리스트 모드)일 때도 이 페이지의 모든 문장은 사실이어야 한다:
//   "'광고' 표시가 없는 카드에는 제휴 링크가 없다"는 문장으로 두 상태를 모두 덮는다.
// ============================================

/** 카드 맨 위 배지 글자. 한국어 '광고' 하나만 쓴다(AD·Sponsored 금지 — 심사지침 '동일한 언어'). */
export const AD_BADGE_LABEL = "광고";

/** 제휴사 코드 → 사람에게 보이는 이름. affiliate.ts 의 partner 값과 같은 키. */
export const PARTNER_NAMES: Record<string, string> = {
  linkprice: "링크프라이스",
  naver_shopping_connect: "네이버 쇼핑 커넥트",
};

/**
 * 카드 고지 1줄 — 제휴사별. affiliate.ts PARTNER_COPY[partner].disclosure 와 글자까지 같아야 한다.
 * - linkprice: 품목 '검색 결과' 딥링크
 * - naver_shopping_connect: 상품 1개 링크 · 쇼핑 커넥트 가이드의 필수 문구 요소(활동명·수수료)
 */
export const CARD_DISCLOSURE: Record<string, string> = {
  linkprice:
    "이 카드의 가격 보기 링크로 사면 엄빠레이더가 판매 수수료를 받아요. 사는 분이 내는 값은 같아요.",
  naver_shopping_connect:
    "네이버 쇼핑 커넥트 활동의 일환으로, 이 카드의 가격 보기 링크로 사면 엄빠레이더가 판매 수수료를 받아요. 사는 분이 내는 값은 같아요.",
};

/** 카드 하단 링크 안내 — 제휴사별. affiliate.ts PARTNER_COPY[partner].linkNote 와 같아야 한다. */
export const CARD_LINK_NOTE: Record<string, string> = {
  linkprice:
    "가격 보기는 특정 제품 추천이 아니라 품목 검색 결과로 연결돼요. 가격·재고는 판매처 기준이에요.",
  naver_shopping_connect:
    "가격 보기는 품목마다 판매 상품 1개로 연결돼요. 써 보고 고른 제품이 아니니 다른 상품과 비교해 보세요. 가격·재고는 판매처 기준이에요.",
};

/** 링크를 절대 걸지 않는 품목 묶음(affiliate.ts safety·noLink 와 같은 규칙). */
export const NEVER_LINK_GROUPS = [
  "아기 몸을 지키는 안전 제품(카시트·아기침대·유아용 의자 등) — 대신 제품안전정보센터 인증 조회만 연결",
  "먹는 것(이유식 재료·분유 등)",
  "서류·신청(신분증·증명서·지원 신청)",
] as const;

/** 개인정보처리방침 '쿠키' 절에 들어가는 1줄. */
export const PRIVACY_PARTNER_COOKIE_LINE =
  "제휴(가격 보기) 링크를 누르면, 이동한 제휴사·판매처가 구매 실적을 확인하려고 그쪽 사이트에서 쿠키를 저장할 수 있습니다. 이 쿠키는 엄빠레이더가 읽거나 저장하지 않으며, 제휴 링크를 누르지 않으면 생기지 않습니다.";

/**
 * 안내 게시일(KST, YYYY-MM-DD). 배포하는 날로 한 줄만 바꾼다.
 * 개인정보처리방침 11절·이용약관 제11조는 '광고 도입' 같은 중대한 변경을 30일 전에 공지한다고 약속했다
 * → 제휴 링크는 게시일 + PARTNER_NOTICE_DAYS 일 이후에만 붙인다(/about/partners 상단에 날짜 표시).
 */
export const PARTNER_NOTICE_POSTED = "2026-11-17";
export const PARTNER_NOTICE_DAYS = 30;

/** 게시일 + 30일 (KST 날짜 문자열). */
export function partnerLinksFrom(): string {
  const d = new Date(`${PARTNER_NOTICE_POSTED}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + PARTNER_NOTICE_DAYS);
  // KST 자정 → UTC 15:00 전날이므로 +9h 해서 날짜만 뽑는다.
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** "2026-11-16" → "2026년 11월 16일" */
export function formatKoreanDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export const PARTNERS_PAGE_PATH = "/about/partners";

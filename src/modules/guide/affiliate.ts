// ============================================
// 가이드 제휴(체크리스트) 카드 데이터 — 정적, DB 없음
//
// 정본 기획: work 30-umbba/엄빠레이더/수익화/수익후보-비교-20261111.md (C205)
//          시안 시안-출산준비물-제휴카드.html · 패치 C214
// - 이 파일에 데이터가 있는 slug 에서만 /guide/[slug] 에 카드가 뜬다(지금은 birth-prep-list 1편).
// - content/ 는 guide_build.py 생성물이라 여기(content 밖)에 둔다 — 재생성해도 지워지지 않는다.
// - url 이 null 인 품목은 '가격 보기' 버튼을 숨긴다. 제휴 링크가 하나도 없으면
//   카드는 '체크리스트 전용'(광고 배지·수수료 고지 없음)으로 렌더된다.
// - 안전 품목(safety=true)은 제휴 링크를 걸지 않는다 — url 대신 제품안전정보센터로만 보낸다.
//
// ▶ 제휴 링크 넣는 곳: 아래 BIRTH_PREP 의 partner 와 각 품목 url (https:// 만 허용)
// ============================================

export type AffiliateGroup = "clothes" | "feeding" | "hygiene" | "safety";

export interface AffiliateItem {
  /** 이벤트 item 값 — 바꾸면 집계가 끊긴다 */
  id: string;
  name: string;
  qty: string;
  group: AffiliateGroup;
  /** 제휴 링크. null 이면 버튼 숨김. safety 품목은 항상 null 로 둔다 */
  url: string | null;
  safety: boolean;
}

export interface GuideAffiliate {
  slug: string;
  /** 제휴사 코드(예: "naver_shopping_connect", "linkprice"). 가입 전 null */
  partner: string | null;
  items: AffiliateItem[];
}

export const AFFILIATE_GROUP_LABELS: Record<AffiliateGroup, string> = {
  clothes: "옷",
  feeding: "수유",
  hygiene: "위생",
  safety: "안전인증 먼저",
};

export const AFFILIATE_GROUP_ORDER: AffiliateGroup[] = [
  "clothes",
  "feeding",
  "hygiene",
  "safety",
];

/** 안전 품목 '인증 조회' 연결처 — 제휴 아님 */
export const SAFETY_CHECK_URL = "https://www.safetykorea.kr";

// 수량은 birth-prep-list 본문 표(아이사랑 안내)와 같게 쓴다.
// 체온계(의료기기)·손싸개는 C205 시안대로 목록에서 뺐다.
const BIRTH_PREP: GuideAffiliate = {
  slug: "birth-prep-list",
  partner: null,
  items: [
    { id: "baenet", name: "배냇저고리", qty: "순면, 3~4개", group: "clothes", url: null, safety: false },
    { id: "underwear", name: "속내의", qty: "2~3개 정도", group: "clothes", url: null, safety: false },
    { id: "swaddle", name: "속싸개·겉싸개", qty: "속싸개 2개, 외출용 겉싸개", group: "clothes", url: null, safety: false },
    { id: "bottle", name: "우유병(젖병)", qty: "모유 수유도 2~3개, 아니면 7~8개", group: "feeding", url: null, safety: false },
    { id: "nipple_brush", name: "젖꼭지·우유병 브러시", qty: "젖꼭지 3~4개, 브러시 1개", group: "feeding", url: null, safety: false },
    { id: "diaper", name: "신생아 기저귀", qty: "30장 정도", group: "hygiene", url: null, safety: false },
    { id: "gauze", name: "가제 손수건", qty: "여러 장", group: "hygiene", url: null, safety: false },
    { id: "crib", name: "아기침대·아기띠", qty: "안전인증 표시 확인", group: "safety", url: null, safety: true },
    { id: "carseat", name: "카시트", qty: "차로 퇴원하면 출산 전에", group: "safety", url: null, safety: true },
  ],
};

const AFFILIATES: Record<string, GuideAffiliate> = {
  [BIRTH_PREP.slug]: BIRTH_PREP,
};

/** https 링크만 인정한다(오타·javascript: 방지). 안전 품목은 링크를 무시한다. */
export function affiliateHref(item: AffiliateItem): string | null {
  if (item.safety || !item.url) return null;
  return /^https:\/\/[^\s]+$/.test(item.url) ? item.url : null;
}

/** 제휴 링크가 하나라도 있으면 true → 광고 배지·수수료 고지를 보인다 */
export function hasAffiliateLinks(data: GuideAffiliate): boolean {
  return data.items.some((i) => affiliateHref(i) !== null);
}

export function getGuideAffiliate(slug: string): GuideAffiliate | null {
  return AFFILIATES[slug] ?? null;
}

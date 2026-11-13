// ============================================
// 가이드 제휴(체크리스트) 카드 데이터 — 정적, DB 없음
//
// 정본 기획: work 30-umbba/엄빠레이더/수익화/수익후보-비교-20261111.md (C205)
//          시안 시안-출산준비물-제휴카드.html · 패치 C214(0001) · C225(0003, 2·3번째 자리)
//          · C263(0004, 4번째 자리 — 2027 배포분 daycare-entry-prep)
// - 이 파일의 AFFILIATES 맵에 데이터가 있는 slug 에서만 /guide/[slug] 에 카드가 뜬다.
//   지금 4편: birth-prep-list · before-birth-todo · weaning-start · daycare-entry-prep
//   (daycare-entry-prep 은 가이드 본문이 배포되기 전엔 /guide/daycare-entry-prep 이 없어 카드도 안 뜬다)
// - content/ 는 guide_build.py 생성물이라 여기(content 밖)에 둔다 — 재생성해도 지워지지 않는다.
// - url 이 null 인 품목은 '가격 보기' 버튼을 숨긴다. 그 편에 제휴 링크가 하나도 없으면
//   카드는 '체크리스트 전용'(광고 배지·수수료 고지 없음)으로 렌더된다. 판단은 편마다 따로다.
// - 안전 품목(safety=true)은 제휴 링크를 걸지 않는다 — url 대신 제품안전정보센터로만 보낸다.
// - noLink=true 품목(먹는 것·서류 등)은 url 을 넣어도 링크가 생기지 않는다 — 체크만 한다.
// - 품목은 그 편 본문(FAQ 포함)에 나오는 것만 쓴다. 수량·메모도 본문 문장 안에서만.
//
// ▶ 제휴 링크 넣는 곳: 아래 각 편 상수(BIRTH_PREP · BEFORE_BIRTH · WEANING_START · DAYCARE_ENTRY)의
//   partner 와 각 품목 url (https:// 만 허용)
// ============================================

export type AffiliateGroup =
  | "clothes"
  | "feeding"
  | "hygiene"
  | "mom"
  | "baby"
  | "tools"
  | "food"
  | "docs"
  | "daycare"
  | "safety";

export interface AffiliateItem {
  /** 이벤트 item 값 — 바꾸면 집계가 끊긴다 */
  id: string;
  name: string;
  qty: string;
  group: AffiliateGroup;
  /** 제휴 링크. null 이면 버튼 숨김. safety·noLink 품목은 항상 null 로 둔다 */
  url: string | null;
  safety: boolean;
  /** true 면 url 을 넣어도 링크를 만들지 않는다(먹는 것·서류 등 체크 전용) */
  noLink?: boolean;
}

export interface GuideAffiliate {
  slug: string;
  /** 제휴사 코드(예: "naver_shopping_connect", "linkprice"). 가입 전 null */
  partner: string | null;
  items: AffiliateItem[];
  /** 카드 제목. 없으면 "출산 준비물 체크" */
  title?: string;
  /** 제목 아래 한 줄. 없으면 출산 준비물 기본 문구 */
  lead?: string;
  /** 그룹 아래 안내 문구. safety 는 없으면 기본 문구 */
  notes?: Partial<Record<AffiliateGroup, string>>;
  /**
   * 카드 머리 그림 자리(codex X124 산출 예정 — 지금은 null, 화면에 쓰지 않는다).
   * 예정 경로: /guide/affiliate/{slug}-card.png (public/, 1200×400)
   */
  heroImage?: string | null;
}

export const AFFILIATE_GROUP_LABELS: Record<AffiliateGroup, string> = {
  clothes: "옷",
  feeding: "수유",
  hygiene: "위생",
  mom: "입원 준비",
  baby: "아기에게 입힐 것",
  tools: "먹이는 도구",
  food: "첫 음식",
  docs: "입소 서류",
  daycare: "어린이집 준비물",
  safety: "안전인증 먼저",
};

export const AFFILIATE_GROUP_ORDER: AffiliateGroup[] = [
  "clothes",
  "feeding",
  "hygiene",
  "mom",
  "baby",
  "tools",
  "food",
  "docs",
  "daycare",
  "safety",
];

/** 안전 품목 '인증 조회' 연결처 — 제휴 아님 */
export const SAFETY_CHECK_URL = "https://www.safetykorea.kr";

export const DEFAULT_AFFILIATE_TITLE = "출산 준비물 체크";
export const DEFAULT_AFFILIATE_LEAD =
  "아이사랑 공식 목록 기준 수량이에요. 챙긴 건 체크해 두세요. 이 기기에만 저장돼요.";
export const DEFAULT_SAFETY_NOTE =
  "아기 몸을 지키는 제품은 엄빠레이더가 고르지 않아요. 제품안전정보센터에서 인증번호를 확인하고, 빌리거나 중고로 살 때도 확인하세요.";

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

// before-birth-todo FAQ '막달 준비물은 무엇을 챙기나요?'(아이사랑 입원 준비물품)와
// 본문 체크 항목('카시트 달기'·'입원 준비물 챙기기')에 나오는 것만.
// 아이사랑 목록엔 수량이 없어 수량 대신 본문의 쓰임을 적었다.
const BEFORE_BIRTH: GuideAffiliate = {
  slug: "before-birth-todo",
  partner: null,
  title: "입원 준비물 체크",
  lead: "아이사랑 입원 준비물품 목록이에요. 출산 병원 안내를 먼저 확인하고, 챙긴 건 체크해 두세요. 이 기기에만 저장돼요.",
  heroImage: null,
  items: [
    { id: "mom_warm_underwear", name: "산모 보온용 내의", qty: "산모 보온용", group: "mom", url: null, safety: false },
    { id: "long_socks", name: "목이 긴 양말", qty: "산모 보온용", group: "mom", url: null, safety: false },
    { id: "nursing_bra_pad", name: "수유브라·패드", qty: "산모용", group: "mom", url: null, safety: false },
    { id: "towel", name: "수건", qty: "입원 때 쓸 것", group: "mom", url: null, safety: false },
    { id: "thin_blanket", name: "얇은 담요", qty: "산모 보온용", group: "mom", url: null, safety: false },
    { id: "parent_id", name: "부모 신분증", qty: "입원 수속·출생증명서 발급 때 필요", group: "mom", url: null, safety: false, noLink: true },
    { id: "baenet", name: "배냇저고리", qty: "아기에게 입힐 것", group: "baby", url: null, safety: false },
    { id: "swaddle", name: "속싸개·겉싸개", qty: "아기에게 입힐 것", group: "baby", url: null, safety: false },
    { id: "carseat", name: "카시트", qty: "차로 퇴원하면 뒷좌석에 미리", group: "safety", url: null, safety: true },
  ],
};

// weaning-start 본문('처음엔 어떻게 먹이나요?'·시작 신호)과 FAQ '이유식 시작 준비물은 무엇인가요?'에
// 나오는 것만. 먹는 것은 링크하지 않는다(noLink) — 분유처럼 아기가 먹는 물건은 제휴 제외(C205 원칙 확장).
// 아기가 앉는 의자는 몸을 받치는 제품이라 안전 품목으로 둔다.
const WEANING_START: GuideAffiliate = {
  slug: "weaning-start",
  partner: null,
  title: "이유식 시작 준비 체크",
  lead: "본문에 나온 공식 안내 기준이에요. 챙긴 건 체크해 두세요. 이 기기에만 저장돼요.",
  heroImage: null,
  notes: {
    food: "먹는 것은 엄빠레이더가 링크하지 않아요. 시작 시기와 첫 음식은 소아청소년과 의사와 상담하세요.",
    safety:
      "아기가 앉는 의자는 엄빠레이더가 고르지 않아요. 인증 정보는 제품안전정보센터에서 찾아볼 수 있어요.",
  },
  items: [
    { id: "baby_spoon", name: "아기 숟가락", qty: "숟가락으로, 처음엔 반 스푼 이하", group: "tools", url: null, safety: false },
    { id: "cup", name: "아기 컵", qty: "6~9개월부터 컵 연습", group: "tools", url: null, safety: false },
    { id: "rice_porridge", name: "쌀 미음", qty: "질병관리청이 권하는 첫 음식", group: "food", url: null, safety: false, noLink: true },
    { id: "iron_food", name: "철분 강화 곡분·육류", qty: "초기부터 철분을 주라는 안내", group: "food", url: null, safety: false, noLink: true },
    { id: "baby_chair", name: "유아용 의자", qty: "높은 의자나 머리 조절이 잘 되는 것", group: "safety", url: null, safety: true },
  ],
};

// daycare-entry-prep(2027 배포분 원고) 표 '입소가 정해지면 어떤 서류를 내나요?'의 서류 4가지와
// 본문 '준비물과 적응 일정'의 이름표·여벌옷만. 서류는 체크만 한다(noLink).
// 준비물은 어린이집마다 달라 공식 목록이 없다(본문 FAQ) → 본문에 나온 2개만 두고 안내문을 먼저 보라고 쓴다.
// 안전 품목 없음(아기 몸을 받치는 제품·먹는 것이 본문에 없다).
const DAYCARE_ENTRY: GuideAffiliate = {
  slug: "daycare-entry-prep",
  partner: null,
  title: "어린이집 입소 준비 체크",
  lead: "공식 안내로 확인되는 서류 4가지와 본문에 나온 준비물이에요. 챙긴 건 체크해 두세요. 이 기기에만 저장돼요.",
  heroImage: null,
  notes: {
    docs: "어린이집마다 받는 양식이 더 있을 수 있어요. 자동으로 연계되는 자격은 서류를 따로 내지 않아도 돼요.",
    daycare: "준비물은 어린이집마다 달라서 공식 목록이 없어요. 입소 전에 받는 어린이집 안내문을 기준으로 챙기세요.",
  },
  items: [
    { id: "checkup_result", name: "건강검진결과통보서", qty: "건강보험공단 영유아 건강검진 결과조회", group: "docs", url: null, safety: false, noLink: true },
    { id: "vaccine_cert", name: "예방접종증명서", qty: "어린이집이 따로 달라고 하면 예방접종도우미·정부24(무료)", group: "docs", url: null, safety: false, noLink: true },
    { id: "priority_proof", name: "우선순위 증빙", qty: "재직·소득증명 등, 어린이집이나 아이사랑에 제출", group: "docs", url: null, safety: false, noLink: true },
    { id: "fee_support", name: "보육료 지원 신청", qty: "주민센터·복지로 — 카드만 만들면 시작되지 않아요", group: "docs", url: null, safety: false, noLink: true },
    { id: "name_label", name: "이름표", qty: "어린이집 안내문 기준", group: "daycare", url: null, safety: false },
    { id: "spare_clothes", name: "여벌옷", qty: "어린이집 안내문 기준", group: "daycare", url: null, safety: false },
  ],
};

const AFFILIATES: Record<string, GuideAffiliate> = {
  [BIRTH_PREP.slug]: BIRTH_PREP,
  [BEFORE_BIRTH.slug]: BEFORE_BIRTH,
  [WEANING_START.slug]: WEANING_START,
  [DAYCARE_ENTRY.slug]: DAYCARE_ENTRY,
};

/** https 링크만 인정한다(오타·javascript: 방지). 안전·noLink 품목은 링크를 무시한다. */
export function affiliateHref(item: AffiliateItem): string | null {
  if (item.safety || item.noLink || !item.url) return null;
  return /^https:\/\/[^\s]+$/.test(item.url) ? item.url : null;
}

/** 제휴 링크가 하나라도 있으면 true → 광고 배지·수수료 고지를 보인다 */
export function hasAffiliateLinks(data: GuideAffiliate): boolean {
  return data.items.some((i) => affiliateHref(i) !== null);
}

export function getGuideAffiliate(slug: string): GuideAffiliate | null {
  return AFFILIATES[slug] ?? null;
}

/** 카드가 붙는 slug 목록(테스트·문서용) */
export function listAffiliateSlugs(): string[] {
  return Object.keys(AFFILIATES);
}

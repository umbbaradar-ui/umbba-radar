// ============================================
// 온보딩 튜토리얼 스텝 정의 (메인 화면 "/" 한정, 8스텝)
// - selector 있는 스텝: 해당 영역을 스포트라이트(딤+구멍+링)
// - selector 없는 스텝: 가운데 안내 카드(인트로/아웃트로/개념 설명) — 딤만
// ============================================

export interface TutorialStep {
  /** 디버그·키 용도 */
  id: string;
  /** 하이라이트 대상 CSS 셀렉터(첫 보이는 매치). 없으면 가운데 안내 카드 */
  selector?: string;
  title: string;
  body: string;
  /** 코치카드를 대상 위/아래 어디에 둘지(공간 부족 시 자동 반대편). 기본 below */
  placement?: "above" | "below";
  /** 대상이 없어도 되는 스텝(없으면 가운데 폴백으로 표시) */
  optional?: boolean;
}

/** 카피·스텝을 바꿔 전체 재노출 시키고 싶을 때 올리는 버전(localStorage 값) */
export const TUTORIAL_VERSION = 1;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    title: "🐻 엄빠레이더에 오신 걸 환영해요",
    body: "엄빠레이더는 부모님 대신 매일 협찬·체험단·이벤트를 모아주는 ‘혜택 레이더’예요. 30초면 사용법을 다 익힐 수 있어요!",
  },
  {
    id: "scan-banner",
    selector: '[data-tutorial="scan-banner"]',
    title: "매일 자동으로 스캔해요",
    body: "곰이 매일 새 혜택과 곧 마감되는 협찬을 모아드려요. 위 숫자로 ‘오늘 새로 뜬 소식’을 한눈에 알 수 있어요.",
    placement: "below",
    optional: true,
  },
  {
    id: "search",
    selector: '[data-tutorial="search"]',
    title: "찾는 게 있으면 검색하세요",
    body: "브랜드 이름이나 키워드로 원하는 협찬·체험단을 바로 찾을 수 있어요.",
    placement: "below",
  },
  {
    id: "filter-pills",
    selector: '[data-tutorial="filter-pills"]',
    title: "우리 아이 맞춤으로 좁히기",
    body: "아이 시기를 등록하면 ‘💛 내 아이’에서 맞춤 혜택만 골라봐요. 시기·주제·유형으로도 좁힐 수 있어요.",
    placement: "below",
  },
  {
    id: "post-card-read",
    selector: '[data-tutorial="post-card"]',
    title: "혜택 카드 읽는 법",
    body: "빨간 ‘D-2’는 마감 임박! 초록 ‘NEW’는 새로 올라온 글, ‘상시’는 마감 없는 혜택이에요.",
    placement: "above",
    optional: true,
  },
  {
    id: "post-card-apply",
    selector: '[data-tutorial="post-card"]',
    title: "카드를 누르면 신청까지",
    body: "카드를 열면 상세에서 신청 방법·링크·마감일을 볼 수 있어요. ‘신청함’으로 표시해두면 잊지 않게 저장돼요.",
    placement: "above",
    optional: true,
  },
  {
    id: "tab-my",
    selector: '[data-tutorial="tab-my"]',
    title: "저장한 혜택은 ‘내 레이더’에",
    body: "관심·신청함으로 표시한 카드는 여기 모여요. 마감 놓치지 않게 ‘내 레이더’에서 다시 확인하세요.",
    placement: "above",
    optional: true,
  },
  {
    id: "outro",
    title: "이제 시작해볼까요? 🎉",
    body: "이 설명은 ‘더보기 → 사용법 다시보기’에서 언제든 다시 볼 수 있어요. 좋은 혜택 많이 챙겨가세요!",
  },
];

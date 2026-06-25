// ============================================
// 온보딩 튜토리얼 스텝 정의 (메인 화면 "/" 한정)
// 각 스텝은 data-tutorial 앵커를 가리킨다. 앵커가 없으면(optional) 자동으로
// 가운데 카드 폴백 → 멈추지 않음.
// ============================================

export interface TutorialStep {
  /** 디버그·키 용도 */
  id: string;
  /** 하이라이트할 대상 CSS 셀렉터 (첫 매치) */
  selector: string;
  title: string;
  body: string;
  /** 코치카드를 대상 위/아래 어디에 둘지 (공간 부족 시 자동 반대편) */
  placement: "above" | "below";
  /** 대상이 없어도 되는 스텝(없으면 가운데 폴백으로 표시) */
  optional?: boolean;
}

/** 카피·스텝을 바꾸면 올려서 전체 재노출 시킬 수 있는 버전 (localStorage 값) */
export const TUTORIAL_VERSION = 1;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "scan-banner",
    selector: '[data-tutorial="scan-banner"]',
    title: "🐻 곰이 매일 혜택을 스캔해요",
    body: "새로 뜬 혜택과 곧 마감되는 협찬을 매일 모아드려요.",
    placement: "below",
    optional: true,
  },
  {
    id: "search",
    selector: '[data-tutorial="search"]',
    title: "브랜드·키워드로 바로 찾기",
    body: "궁금한 브랜드 이름을 검색해 협찬·체험단을 확인하세요.",
    placement: "below",
  },
  {
    id: "filter-pills",
    selector: '[data-tutorial="filter-pills"]',
    title: "내 아이 맞춤으로 좁히기",
    body: "아이 시기를 등록하면 ‘💛 내 아이’ 맞춤만 골라볼 수 있어요.",
    placement: "below",
  },
  {
    id: "post-card",
    selector: '[data-tutorial="post-card"]',
    title: "카드를 열면 신청 방법까지",
    body: "빨간 D-day는 마감 임박! 카드를 탭하면 ‘관심·신청함’으로 저장돼요.",
    placement: "above",
    optional: true,
  },
  {
    id: "tab-my",
    selector: '[data-tutorial="tab-my"]',
    title: "저장한 혜택은 여기 모여요",
    body: "관심·신청한 카드는 ‘내 레이더’에서 다시 볼 수 있어요.",
    placement: "above",
    optional: true,
  },
];

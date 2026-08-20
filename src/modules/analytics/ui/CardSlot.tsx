"use client";

// ============================================
// CardSlot — 카드가 "어느 영역 / 몇 번째 자리"에서 눌렸는지 기록
//
// 왜 필요한가 (2026-08-20):
//   기존 `card_click`은 **상세 페이지 마운트 시점**에 찍혀서(CardClickTracker)
//   "어디서 눌러서 들어왔는지"를 알 수 없다. → 영역별·자리별 성과를 못 잼.
//   이 값이 쌓이면 나중에 (1) 배너·프리미엄 카드를 실제로 잘 눌리는 자리에 배치하고,
//   (2) B2B 상품화 시 "이 자리는 CTR N%" 라는 근거로 단가를 매길 수 있다.
//   유저가 적은 지금부터 쌓아야 의미가 생기는 데이터라 선행 계측한다.
//
// 설계:
//   - `card_click`은 **건드리지 않는다** (기존 CTR 집계·과거 데이터 호환 유지).
//     대신 클릭 지점에서 `card_open`을 따로 발생시킨다.
//   - 래퍼는 `display: contents` — 그리드/플렉스 레이아웃에 전혀 영향 없음.
//   - onClickCapture라 카드 내부 어디를 눌러도 잡힌다.
// ============================================

import { track } from "../service";

/** 카드가 놓인 영역. 새 영역을 추가하면 여기에 리터럴을 추가할 것 */
export type CardZone =
  | "deadline_radar" // 홈 2. 마감 레이더
  | "keyword" // 홈 3. 요즘 키워드 모아보기
  | "my_child_new" // 홈 4. 우리 아이 시기 신규
  | "guest_teaser" // 홈 4-변형. 비로그인 티저
  | "editor_pick" // 홈 5. 엄빠레이더 추천 픽
  | "deadline_unknown" // 홈 6. 마감미정 혜택
  | "explore_grid" // /explore 전체 그리드
  | "my_radar"; // /my 내 레이더

interface Props {
  postId: string;
  zone: CardZone;
  /** 영역 내 자리 번호 (0-based) */
  position: number;
  /** 그 영역에 실제로 노출된 카드 수 — 자리별 CTR 계산의 분모 보정용 */
  listLen: number;
  /** 부가 맥락 (예: 키워드 영역의 선택 키워드) */
  meta?: Record<string, string | number | boolean>;
  children: React.ReactNode;
}

export function CardSlot({
  postId,
  zone,
  position,
  listLen,
  meta,
  children,
}: Props) {
  function handleClick() {
    track("card_open", {
      post_id: postId,
      zone,
      position,
      list_len: listLen,
      ...meta,
    });
  }

  return (
    // display:contents — 레이아웃상 존재하지 않는 래퍼(그리드 아이템 자리를 뺏지 않음)
    <div style={{ display: "contents" }} onClickCapture={handleClick}>
      {children}
    </div>
  );
}

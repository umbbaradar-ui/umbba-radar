// ============================================
// 현장형 경품 가드 (2026-10-04 은재)
// "집에서 스마트폰만으로 응모부터 수령까지" 가 아닌 카드를 **규칙으로** 막는다.
//   - 지금까지는 RULES.md 의 분류 지침(LLM)에만 의존해 예매권·초대권·공연 관람권이 그대로 발행됐다
//     (실측 2026-10-04: 최근 30일 발행 268건 중 티켓 키워드 5건 노출, 최종 규칙 적중 2건 — 전부 ai_review pass 92·95점).
//   - 그래서 분류·검수와 **독립적으로** 동작하는 결정적 판정을 둔다. 자동 발행 직전·검수 직후에 호출한다.
// 판정 결과는 skip 사유 문자열로 그대로 쓸 수 있다.
// ============================================

/** 경품 자체가 현장에서만 쓰이는 권리 — 받아도 그 지역에 가야 한다 */
const PRIZE_TICKET = [
  /예매권/, /관람권/, /초대권/, /입장권/, /시사회/, /관람\s*티켓/, /공연\s*티켓/,
  /티켓\s*(증정|제공|지급|드립니다|선물)/, /응모권/,
  /(키즈카페|수영장|워터파크|놀이공원|체험관|전시회|박물관|과학관|동물원)\s*(이용권|입장권|자유이용권)/,
  /자유이용권/, /이용권\s*(증정|제공|지급|드립니다)/,
  /(공연|뮤지컬|콘서트|연극|전시)\s*(관람권?|초대권?|티켓|예매)/,   // 경품으로서의 관람 — 실물 경품이 함께면 살린다
];

/** 당첨 혜택이 오프라인 참석 그 자체 */
const OFFLINE_BENEFIT = [
  // 혜택 자체가 '그 자리에 가는 것' — 실물 경품이 함께 있어도 살리지 않는다
  /(클래스|강좌|세미나|워크숍|산모교실|교실|캠프|런|마라톤)\s*(참가자?\s*모집|참가권|참여권|초대|수강권)/,
  /(현장|부스|매장|지점|센터)\s*(수령|방문\s*수령)/,
];   // '참가자 모집' 단독은 온라인 공모전(숏폼·사진)도 걸려 제외 (2026-10-04 실측 오탐)

/** 참여 조건이 방문 — 팝업·박람회·매장 (홍보 문구만 섞인 경우와 구분하려고 '방문/인증/현장' 과 함께 볼 때만) */
const VISIT_REQUIRED = [
  /팝업\s*(스토어)?\s*(방문|현장|에서)\s*(인증|응모|참여|선착순|증정|룰렛|스탬프)/,
  /(박람회|베페|코베|엑스포)\s*(부스\s*)?(방문|현장)\s*(인증|응모|참여|선착순|증정)/,
  /(매장|백화점|행사장|지점)\s*(방문|내점)\s*(시|고객)?\s*(증정|한정|응모|참여)/,
  /방문\s*인증(샷)?/, /현장\s*(접수|응모|추첨)/,
];

/** 온라인 완결 신호 — 위 패턴이 홍보 문구로만 섞였을 때 살리기 위한 반증 */
const ONLINE_DELIVERY = [/택배/, /배송/, /모바일\s*(쿠폰|상품권|교환권)/, /기프티콘/, /개별\s*DM/, /문자\s*발송/];

/** 인정 경품 — 티켓과 **함께** 걸려 있으면 그 경품 기준으로 살린다 (W-20261004-1 §13, §11 과 같은 취지) */
const GOODS_PRIZE = [
  // 단순 언급이 아니라 '경품으로 준다' 는 꼴일 때만 인정한다 (수량/세트/증정 동반)
  /(육아템|육아\s*용품|제품|본품|정품|실물)\s*\d+\s*(종|세트|개|박스|팩)/,
  /(육아템|육아\s*용품|본품|정품|실물)\s*(세트|증정|제공|지급|선물)/,
  /(기저귀|분유|물티슈|유모차|카시트|젖병|장난감|완구|도서|화장품|스킨케어|의류|내의|식품|간식)\s*(\d+\s*(종|세트|개|박스|팩)|세트|증정|제공|지급|선물)/,
  /(백화점|신세계|롯데|현대|이마트|홈플러스)\s*상품권/, /네이버페이/, /문화상품권/, /치킨\s*(기프티콘|쿠폰)?/,
];

export interface OfflinePrizeVerdict {
  /** true 면 발행 금지 (skip / 자동 발행 제외) */
  blocked: boolean;
  /** skip_reason 에 그대로 쓸 사유 */
  reason?: string;
  /** 어떤 표현에 걸렸는지 (로그·검수 노트용) */
  matched: string[];
}

function hits(text: string, pats: RegExp[]): string[] {
  const out: string[] = [];
  for (const p of pats) { const m = text.match(p); if (m) out.push(m[0].replace(/\s+/g, " ").trim()); }
  return out;
}

/**
 * 제목·본문·경품 텍스트를 합쳐 넘긴다. 결정적(사람·LLM 판단 불필요) 판정만 한다.
 * - 티켓류 경품·오프라인 참석 혜택: 무조건 blocked (택배 문구가 있어도 '권리' 자체가 현장용이라 살리지 않는다)
 * - 방문 조건: 온라인 완결 신호가 같이 있으면 살린다 (캡션에 팝업 홍보만 섞인 흔한 경우)
 */
export function detectOfflinePrize(raw: string | null | undefined): OfflinePrizeVerdict {
  const text = (raw ?? "").replace(/\s+/g, " ");
  if (!text) return { blocked: false, matched: [] };

  const ticket = hits(text, PRIZE_TICKET);
  if (ticket.length) {
    // 티켓과 함께 실물·고액 경품이 걸려 있으면 그 경품 기준으로 살린다 (W-20261004-1 §13)
    const goods = hits(text, GOODS_PRIZE);
    if (!goods.length) return { blocked: true, reason: "경품이 현장 이용 권리(예매·관람·초대·이용권) (정책)", matched: ticket };
  }

  const benefit = hits(text, OFFLINE_BENEFIT);
  if (benefit.length) return { blocked: true, reason: "당첨 혜택이 오프라인 참석 (정책)", matched: benefit };

  const visit = hits(text, VISIT_REQUIRED);
  if (visit.length) {
    const online = hits(text, ONLINE_DELIVERY);
    if (!online.length) return { blocked: true, reason: "현장 방문형 이벤트 (정책)", matched: visit };
  }
  return { blocked: false, matched: [] };
}

/** posts 레코드에서 판정용 텍스트를 만든다 */
export function prizeTextOf(p: {
  title?: string | null; body?: string | null; search_keywords?: string[] | null; item_categories?: string[] | null;
}): string {
  return [p.title ?? "", p.body ?? "", (p.search_keywords ?? []).join(" "), (p.item_categories ?? []).join(" ")].join(" ");
}

// ============================================
// 자동 수집 키워드 — 네이버 검색에 매일 조회되는 단어들
// 수정·추가는 이 파일만 손대면 됨. cron이 다음 날 06:00에 적용
// ============================================

export const NAVER_KEYWORDS: string[] = [
  // 모집 카테고리
  "출산 체험단",
  "임산부 체험단",
  "신생아 체험단",
  "유아 체험단",
  "분유 체험단",
  "기저귀 체험단",

  // 이벤트 카테고리
  "육아용품 리그램",
  "출산 무료 샘플",
  "유아 무료 체험",
  "키즈 추첨 이벤트",
];

// 검색 결과당 가져올 개수 (네이버 최대 100)
// Gemini 무료 티어 15 RPM 제한 + 배치 5건씩 → 1회 cron으로 약 30건 처리
export const NAVER_DISPLAY_PER_KEYWORD = 3;

// AI 신뢰도가 이 값 미만이면 적재 안 함 (큐 노이즈 방지)
export const MIN_CONFIDENCE = 0.6;

// Gemini 배치 크기 (한 번에 정규화할 아이템 수)
export const NORMALIZE_BATCH_SIZE = 5;

// Gemini 호출 간 지연 (ms). 15 RPM 안전 마진
export const GEMINI_DELAY_MS = 4500;

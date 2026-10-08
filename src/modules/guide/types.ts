// ============================================
// Guide 타입 — 시기별 가이드(/guide) 데이터 형식
//
// 정본은 work 저장소의 원고 md(30-umbba/엄빠레이더/개발/시기가이드/원고/<slug>.md).
// 변환기(시기가이드/도구/guide_build.py)가 content/*.ts 를 생성한다 — 생성 파일은 직접 고치지 않는다.
// 시기 코드는 카드와 같은 StageCategory 를 쓴다(위젯·탐색 링크가 이 값으로 묶인다).
// ============================================

import type { StageCategory, TypeTag } from "@/shared/types/post";

/** 분류 5종 — money 제도·지원금 / todo 준비·체크리스트 / health 접종·검진 / safety 생활·안전 / sponsor 체험단·협찬 */
export type GuideCategory = "money" | "todo" | "health" | "safety" | "sponsor";

/**
 * 인라인 문자열. 허용 문법은 `**굵게**`, `[문구](https://…)`, `[문구](/guide/slug)` 뿐이다.
 * 변환기가 검사하므로 렌더러(inline.ts)는 이 셋만 안다.
 */
export type InlineText = string;

export type GuideBlock =
  | { type: "h2"; id: string; text: InlineText }
  | { type: "h3"; text: InlineText }
  | { type: "p"; text: InlineText }
  | { type: "ul"; items: InlineText[] }
  | { type: "ol"; items: InlineText[] }
  | { type: "check"; items: InlineText[] }
  | { type: "table"; head: InlineText[]; rows: InlineText[][] }
  | { type: "note"; text: InlineText };

export interface GuideFaq {
  q: string;
  a: InlineText;
}

export interface GuideSource {
  /** 기관명 (예: 복지로) */
  org: string;
  /** 문서·페이지 이름 */
  title: string;
  url: string;
  /** 확인일 YYYY-MM-DD */
  checkedAt: string;
}

/** 목록·사이트맵·클라이언트 링크용 가벼운 정보 (content/catalog.ts) */
export interface GuideLink {
  slug: string;
  /** 질문형 제목 = H1 */
  title: string;
  /** 칩·링크용 짧은 이름 (제목 쉼표 앞 또는 원고 '짧은제목') */
  label: string;
  category: GuideCategory;
  stages: StageCategory[];
  /** 최종 확인일 YYYY-MM-DD — 화면 표기·sitemap·JSON-LD dateModified */
  checkedAt: string;
}

export interface Guide extends GuideLink {
  /** meta description */
  description: string;
  /** 이 편이 노리는 검색어 */
  targetQuery: string;
  /** 근거 검색어(자동완성 수집분) — JSON-LD keywords */
  keywords: string[];
  /** 하단 혜택 위젯에서 우선 보여줄 카드 유형 (체험단 편 등) */
  cardTypes: TypeTag[];
  /** 3줄 답 */
  summary: InlineText[];
  /** 처음 발행일 YYYY-MM-DD */
  publishedAt: string;
  body: GuideBlock[];
  faq: GuideFaq[];
  sources: GuideSource[];
}

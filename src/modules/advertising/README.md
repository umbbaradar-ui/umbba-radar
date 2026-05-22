# Advertising 부서 — 광고 시스템

> Phase 3 활성화 예정. Phase 1엔 슬롯 placeholder만 박혀 있음.

## 슬롯 명단

| ID | 위치 | 광고 부담 | 컨텍스트 | 상품화 단가 (참고) |
|----|------|----------|---------|-------------------|
| `top_banner` | 메인 페이지 상단 (헤더와 필터 사이) | 중 | — | 20~100만원/월 |
| `category_top` | 필터 적용 시 그리드 위 | 낮음 (관심 매칭) | `{ stage, type }` | 30만원/월·카테고리 |
| `detail_bottom` | 카드 상세 하단 (원문 버튼 아래) | 낮음 (행동 직후) | `{ post_id }` | 100~500원/클릭 |
| `my_top` | /my 페이지 상단 | 낮음 | — | (Phase 4+ 가치 평가) |
| `submit_top` | /submit 페이지 상단 | 낮음 | — | (브랜드 인지도용) |

추가로 **컨텐츠 위장형 광고**(sponsored card)는 별도 슬롯 없이 `posts.kind='sponsored_ad'` + `is_sponsored=true` + `pinned_until` 으로 일반 그리드에 자연스럽게 섞임. AdSlot 컴포넌트 안 씀.

## UX 가드레일 (BUSINESS_MODEL.md 와 동일)

- **한 화면당 광고 최대 2개**
- **카테고리 매칭 필수** — 임신중 필터에 초등 영어 광고 금지
- **시각 구분 명확** — "AD" 또는 "광고" 라벨 항상
- **광고주 화이트리스트** — 의료·금융·사행성 거부, 육아 관련만
- **광고 미노출 카테고리** — 0세 신생아 카테고리는 최소화 (신뢰도)

## 사용법 (현재)

```tsx
import { AdSlot } from "@/modules/advertising/ui/AdSlot";

// 정적 슬롯
<AdSlot id="top_banner" />

// 컨텍스트 있는 슬롯 (Phase 3에 광고 매칭 시 사용)
<AdSlot id="category_top" context={{ stage: "newborn" }} />
<AdSlot id="detail_bottom" context={{ post_id: post.id }} />
```

## 디버그 토글

슬롯 위치를 시각적으로 확인하고 싶을 때:

```
# .env.local
NEXT_PUBLIC_DEBUG_ADS=true
```

설정 후 `npm run dev` 재시작 → 슬롯이 **노란 점선 박스**로 표시됨. 운영 환경(Vercel)에선 절대 켜지 말 것.

## Phase 3에 추가할 것

```
modules/advertising/
├── ui/
│   └── AdSlot.tsx              ← 현재 placeholder만, 페치 로직 추가 예정
├── slot/                       ← Phase 3 신설
│   ├── repository.ts           (slots 테이블 + 활성 캠페인 조회)
│   ├── service.ts              (selectActiveAd(slotId, context))
│   └── matcher.ts              (카테고리/타겟팅 매칭 로직)
├── campaign/                   ← 광고주 캠페인 관리
│   ├── repository.ts
│   └── service.ts              (광고주가 콘솔에서 등록)
├── impression/                 ← 노출·클릭 트래킹 (Analytics와 연결)
│   ├── repository.ts
│   └── service.ts
└── billing/                    ← 정산 (Phase 4)
```

## Phase 3 DB 스키마 (예상)

```sql
-- 광고 캠페인
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY,
  advertiser_id UUID,
  slot_id TEXT,                 -- AdSlotId
  creative_url TEXT,
  link_url TEXT,
  target_stages TEXT[],         -- 매칭할 시기 카테고리
  target_types TEXT[],          -- 매칭할 유형 태그
  budget_cents INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT,                  -- 'pending' | 'active' | 'paused' | 'exhausted'
  created_at TIMESTAMPTZ
);

-- 노출·클릭 기록 (events 테이블 별도 사용 가능)
CREATE TABLE ad_impressions (
  id BIGSERIAL,
  campaign_id UUID,
  slot_id TEXT,
  user_id UUID NULL,
  anon_id TEXT,
  was_clicked BOOLEAN DEFAULT false,
  context JSONB,
  created_at TIMESTAMPTZ
);
```

## 결정 보류

- 광고 콘텐츠 자체를 외부 광고 네트워크(예: 카카오모먼트·구글 애드센스)로 위탁할지, 직접 영업할지
- 기준 단가·할인 정책
- 광고주 셀프 콘솔 만들지(자동화), 매번 본인이 등록할지(수동)

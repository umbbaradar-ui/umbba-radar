# 아키텍처 — 엔진 설계 문서

> 마지막 업데이트: 2026-05-21
> 본 문서의 목적: 코드를 쓰기 전에 "부서(엔진) 경계"를 먼저 못 박아, 향후 기능 추가가 **기존 부서 내 수정** 또는 **새 부서 신설** 둘 중 하나로 깔끔하게 떨어지게 한다. 첫 설계가 모든 것을 결정한다.

본 문서는 **모듈러 모놀리스 / 도메인 주도 설계 / 헥사고날 아키텍처**의 개념을 우리 도메인(육아 협찬 큐레이션 웹앱)에 맞춰 단순화한 것이다.

---

## 1. 핵심 원칙 — 한 줄로

> **"부서끼리는 정해진 창구로만 대화한다. 다른 부서 책상 위 서류를 직접 뒤지지 않는다."**

| 잘못 설계됐을 때 | 잘 설계됐을 때 |
|------------------|----------------|
| "광고 기능 추가했더니 검색이 망가졌다" | 광고는 광고 부서에서만 수정, 검색은 무관 |
| "후기 모델 바꿨더니 알림이 멈췄다" | 알림은 후기 부서에 "마감일만" 요청하므로 무관 |
| "공구 붙이려면 코드 절반을 다시 봐야 한다" | 공구는 Content의 새 `kind` 하나 추가로 끝 |

---

## 2. 부서(엔진) 목록 — 9개

### 본업 부서 (도메인 코어)

| # | 부서명 | 책임 한 줄 | 다루는 테이블 | Phase |
|---|--------|-----------|---------------|-------|
| 1 | **Content** | 모집글·후기·공구·광고를 통합 관리 | `posts` | 1 |
| 2 | **Brand** | 브랜드·상품 정보 관리 | `brands`, `products` | 1 |
| 3 | **User** | 가입·로그인·프로필·아이 월령 | `users`, `children` | 1 |
| 4 | **Personalization** | "신청함/관심" 체크, 마이페이지 | `user_post_status` | 1 |
| 5 | **Curation** | 승인 대기함, 상태 머신 관리 | `posts.status` | 1 |
| 6 | **Discovery** | 검색·필터·정렬·추천 (읽기 전용 합성) | 자체 데이터 없음 | 1 |

### 외부 접점 부서 (인프라성)

| # | 부서명 | 책임 한 줄 | Phase |
|---|--------|-----------|-------|
| 7 | **Ingestion** | 자동 수집·사용자 제보 → Curation 큐로 전달 | 2~3 |
| 8 | **Notification** | 마감 D-1, 신규 컨텐츠 알림 | 2 |
| 9 | **Monetization** | 광고·공구·어필리에이트 | 2~3 |

> **중요:** 7~9번은 Phase 1에는 만들지 않는다. 단, **빈 폴더 + README**로 자리만 잡아둔다. 이게 곧 확장성이다.

---

## 3. 부서별 롤 카드

각 부서는 외부에 노출하는 **함수(=창구)** 만 다른 부서에 알려준다. 내부 구현은 비공개.

### 3.1 Content 부서

**책임:** posts 테이블의 단일 진실원천(Single Source of Truth). 모든 컨텐츠는 Content를 거쳐야 한다.

```typescript
// modules/content/service.ts — 공개 창구
export async function createPost(input: PostInput): Promise<Post>
export async function publishPost(id: string): Promise<void>
export async function expirePost(id: string): Promise<void>
export async function getPost(id: string): Promise<Post | null>
export async function listPosts(filters: PostFilters): Promise<Post[]>
export async function expirePostsPastDeadline(): Promise<number>  // 스케줄러용
```

**비공개:** `modules/content/repository.ts` (Supabase 쿼리). 다른 부서는 import 금지.

### 3.2 Brand 부서

**책임:** 브랜드·상품의 마스터 데이터.

```typescript
export async function getBrand(id: string): Promise<Brand | null>
export async function listBrands(): Promise<Brand[]>
export async function upsertBrand(input: BrandInput): Promise<Brand>  // 관리자만
```

### 3.3 User 부서

**책임:** 인증·프로필·자녀 정보. 다른 부서는 절대 직접 auth.users에 접근하지 않는다.

```typescript
export async function getCurrentUser(): Promise<User | null>
export async function getUserChildren(userId: string): Promise<Child[]>
export async function getCurrentChildStage(userId: string): Promise<StageCategory[]>
// ↑ 현재 아이 월령 → 시기 카테고리 자동 매핑
```

### 3.4 Personalization 부서

**책임:** 사용자가 카드에 남긴 행동 기록.

```typescript
export async function markApplied(userId: string, postId: string): Promise<void>
export async function markInterested(userId: string, postId: string): Promise<void>
export async function unmark(userId: string, postId: string): Promise<void>
export async function listUserPosts(
  userId: string,
  status: 'applied' | 'interested'
): Promise<Post[]>
```

### 3.5 Curation 부서

**책임:** 상태 머신(`draft → pending → published → expired`) 관리. 모든 외부 입력은 반드시 여기를 거친다.

```typescript
export async function submitForReview(post: PostInput): Promise<Post>
export async function approve(id: string): Promise<void>   // → Content.publishPost 호출
export async function reject(id: string, reason?: string): Promise<void>
export async function listPendingQueue(): Promise<Post[]>  // 관리자 UI
```

### 3.6 Discovery 부서

**책임:** 읽기 전용 합성. 다른 부서의 데이터를 조합해 화면용 결과를 만든다. 자체 테이블 없음.

```typescript
export async function search(
  query: string,
  filters: PostFilters,
  userContext?: { userId: string }
): Promise<Post[]>

export async function recommendForUser(userId: string): Promise<Post[]>
// ↑ 내부에서 User.getCurrentChildStage() 호출 → Content.listPosts() 필터링
```

### 3.7~3.9 Ingestion / Notification / Monetization

Phase 1엔 폴더 + README만 둔다. 시그니처는 미리 적어둔다:

```typescript
// modules/ingestion/service.ts (Phase 2~3)
export async function ingestFromWhitelist(): Promise<number>
export async function ingestFromUserSubmission(input: SubmissionInput): Promise<void>

// modules/notification/service.ts (Phase 2)
export async function sendDeadlineReminders(): Promise<void>

// modules/monetization/service.ts (Phase 2~3)
export async function listSponsoredSlots(): Promise<Post[]>
export async function recordImpression(postId: string): Promise<void>
```

---

## 4. 부서 간 흐름도

```
                        ┌─────────────────┐
        사용자 행동 ──> │   UI / Pages    │ <── 관리자 행동
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌───────────┐     ┌──────────────┐   ┌────────────┐
        │ Discovery │     │Personalization│   │ Curation   │
        │ (읽기)    │     │ (체크 기록)   │   │ (승인)     │
        └─────┬─────┘     └──────┬───────┘   └─────┬──────┘
              │                  │                 │
              ▼                  ▼                 ▼
        ┌──────────────────────────────────────────────┐
        │                  Content                     │ ← 모든 도메인의 중심
        │            (posts 단일 진실원천)              │
        └──────────────┬──────────────┬────────────────┘
                       │              │
                       ▼              ▼
                 ┌─────────┐    ┌──────────┐
                 │  Brand  │    │   User   │
                 └─────────┘    └────┬─────┘
                                     │
                                     ▼
                              ┌────────────┐
                              │  Children  │
                              │  (월령)    │
                              └────────────┘

        ─────────── 외부 접점 부서 (Phase 2~) ───────────

        ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
        │  Ingestion  │──>│  Curation    │──>│   Content    │
        │ (자동수집)  │   │ (승인대기함) │   │ (발행)       │
        └─────────────┘   └──────────────┘   └──────────────┘

        ┌──────────────┐         ┌──────────────┐
        │ Notification │ <─읽기─ │   Content    │
        │ (D-1 알림)   │         │  (deadline)  │
        └──────────────┘         └──────────────┘

        ┌──────────────┐         ┌──────────────┐
        │ Monetization │ ──주입─>│   Content    │
        │ (광고 슬롯)  │         │ (sponsored)  │
        └──────────────┘         └──────────────┘
```

---

## 5. 의존성 규칙 (절대 어기지 말 것)

```
허용된 import 방향만 가능 (역방향 금지):

  UI ──> Discovery ──> Content
  UI ──> Personalization ──> Content (참조만)
  UI ──> User

  Curation ──> Content
  Ingestion ──> Curation
  Notification ──> Content (읽기만)
  Monetization ──> Content (광고 슬롯 주입)

  Content는 다른 부서를 부르지 않는다. (중앙은 깨끗하게)
  User는 다른 부서를 부르지 않는다. (독립적)
  Brand는 다른 부서를 부르지 않는다. (독립적)
```

**규칙 한 문장:** *"중앙(Content / Brand / User)은 가장자리(Curation, Discovery, Notification 등)를 모른다."*

이게 깨지면 → 가장자리 기능을 추가할 때마다 중앙을 수정 → 리스크 폭증.

---

## 6. 폴더 구조 (Next.js + Supabase)

```
src/
├── modules/                  ← 부서들
│   ├── content/
│   │   ├── domain.ts         ← 타입·비즈니스 규칙 (DB 모름)
│   │   ├── repository.ts     ← Supabase 쿼리 (모듈 외부엔 비공개)
│   │   ├── service.ts        ← 공개 창구 (다른 부서가 import)
│   │   └── ui/               ← Card 컴포넌트 등
│   │
│   ├── brand/        { domain, repository, service, ui }
│   ├── user/         { domain, repository, service, ui }
│   ├── personalization/  { domain, repository, service, ui }
│   ├── curation/     { domain, repository, service, ui }
│   ├── discovery/    { domain, service, ui }     ← repository 없음 (합성만)
│   │
│   ├── ingestion/    README.md (Phase 2)
│   ├── notification/ README.md (Phase 2)
│   └── monetization/ README.md (Phase 2~3)
│
├── shared/                   ← 모든 부서가 쓰는 공통
│   ├── db/                   ← Supabase 클라이언트
│   ├── types/                ← 전역 타입 (예: StageCategory enum)
│   └── utils/                ← 날짜·문자열 등
│
└── app/                      ← Next.js 페이지 (얇게) — Presentation Layer
    ├── (web)/                ← 자체 PWA 채널 (Phase 1, 메인)
    │   ├── page.tsx          ← 메인. modules/discovery 호출
    │   ├── post/[id]/page.tsx ← Content + Personalization
    │   ├── my/page.tsx       ← Personalization
    │   ├── login/page.tsx    ← User
    │   └── admin/
    │       ├── page.tsx      ← Curation 큐 + Content CRUD
    │       └── new/page.tsx
    │
    ├── (toss)/               ← (사용 보류 — README.md만, 별도 Vite 레포로 갈 예정)
    │   └── README.md
    │
    ├── admin/                ← 관리자 영역 (auth + private 라우트 그룹)
    │   ├── (auth)/login/page.tsx
    │   └── (private)/
    │       ├── layout.tsx    ← 쿠키 인증 체크
    │       ├── page.tsx      ← 카드 목록·CRUD
    │       ├── new/page.tsx
    │       └── [id]/edit/page.tsx
    │
    ├── auth/callback/        ← OAuth 콜백 라우트
    │   └── route.ts
    │
    ├── icon.tsx              ← PWA 아이콘 (512x512)
    ├── apple-icon.tsx        ← Apple Touch 아이콘 (180x180)
    └── manifest.ts           ← PWA manifest
```

**강제 규칙:**
- 페이지(`app/`)는 얇게 — 모듈의 `service.ts` 만 호출, 직접 DB 접근 금지
- `repository.ts` 는 같은 모듈 내부에서만 import (private)
- 다른 모듈을 쓸 땐 반드시 `service.ts` 만 import

> 팁: ESLint 규칙으로 `import/no-restricted-paths` 를 걸어 두면 위반을 빌드 단계에서 막을 수 있다.

---

### 6.1 채널 전략 — PWA(이 레포) + 토스 미니앱(별도 Vite 레포)

> **2026-05-22 갱신:** 원래 `app/(web)` + `app/(toss)` 듀얼 라우트 그룹을 계획했으나, 토스 SDK(`@apps-in-toss/web-framework`)가 **Vite 전용**임이 확인됐다. Next.js와 한 프로젝트에서 공존 불가. 따라서 채널 분리 전략을 다음과 같이 수정한다.

| 채널 | 위치 | 스택 | 활성 |
|------|------|------|------|
| 자체 PWA | `umbba-radar/` (이 레포) | Next.js 16 + React Server Components | Phase 1 ✅ |
| 토스 미니앱 | `umbba-radar-toss/` (별도 레포) | Vite + React + `@apps-in-toss/web-framework` | Phase 1.5 |

**공유하는 것:**
- **Supabase 백엔드** 100% 동일 (DB, RLS, 인증, 정책)
- 타입 정의(`Post`, `StageCategory`, 라벨) — 처음엔 수동 복사, Phase 2부터 pnpm workspace 패키지로 공유
- 디자인 토큰(컬러·간격) — Tailwind config 복사

**왜 이 분리가 여전히 옳은가:**
- 토스 정책 변경이 PWA에 무영향
- 토스 SDK가 망가져도 자체 PWA는 살아 있음
- 백엔드는 단일 진실원천 (Supabase)
- 사용자 가입·체크 데이터는 동일 DB 사용 → 양쪽 모두에서 동기화

`app/(toss)/` 폴더는 빈 상태로 두고 `README.md` 만 둠 — 의도 보존용 표식.

---

## 7. 첫 설계에서 박아둘 6가지 원칙

1. **Content가 우주의 중심.** 모든 새 기능은 Content의 새 `kind` 값 추가로 시작
   - 광고 → `kind = 'sponsored_ad'`
   - 공구 → `kind = 'group_buy'`
   - 새 컨텐츠 유형 → 새 kind 하나
2. **상태 머신 하나로 통일.** `draft → pending → published → expired`
   - Ingestion·Curation·사용자 제보 모두 이 머신을 통과
3. **외부 입력은 무조건 Curation을 거친다.** 자동 발행 금지
4. **부서끼리 직접 DB 접근 금지.** 반드시 `service.ts` 창구만
5. **빈 부서도 폴더는 미리 만든다.** 자리를 잡아두면 나중에 안 헷갈림
6. **UI는 부서가 아니다.** UI는 부서들을 조립하는 무대일 뿐, 비즈니스 결정은 안 함

---

## 8. Phase별 부서 활성화 로드맵

| Phase | 활성 부서 | 채널 | 비고 |
|-------|-----------|------|------|
| **Phase 1 (현재)** | Content ✅, Personalization ✅ (localStorage), Curation ✅, Discovery ✅, User ✅ (코드 준비, Supabase OAuth 활성화 대기) | 자체 PWA (Vercel) | `/admin` 보호: `ADMIN_PASSWORD` env var |
| **Phase 1.5** | (동일, 부서 무변경) | + 토스 미니앱 | **별도 Vite 레포** (`umbba-radar-toss/`) 신설. Next.js 통합 불가 |
| **Phase 2** | + Ingestion (화이트리스트 자동수집), Notification (D-1 알림), Personalization 이관 (localStorage → DB) | 양 채널 공통 | Ingestion 출력은 Curation 큐로 |
| **Phase 3** | + Monetization (광고·공구), 사용자 제보 (Ingestion 확장), Brand (정규화) | 양 채널 공통 | 사업자 등록 필요해지는 시점 |

**부서별 현재 상태 (2026-05-22):**
- ✅ **Content** — repository / service / PostCard
- ⬜ **Brand** — Phase 3 정규화 시 가동 (현재 `posts.brand_name` 필드로 처리)
- ✅ **User** — service / actions / SignInButton / UserMenu (Supabase Google OAuth 활성화 대기)
- ✅ **Personalization** — localStorage 기반 (Phase 2에 DB 이관)
- ✅ **Curation** — 관리자 페이지 + CRUD 완료. 승인 큐는 Phase 2에 추가
- ✅ **Discovery** — filterPosts + FilterBar
- ⬜ **Ingestion** — Phase 2 시작 시 가동
- ⬜ **Notification** — Phase 2 시작 시 가동
- ⬜ **Monetization** — Phase 3 시작 시 가동

**시사점:** 9개 부서가 모두 등장한 뒤에도, **Content·Brand·User의 코드는 거의 안 바뀐다.** 가장자리만 늘어난다. 이게 좋은 설계의 증거다.

---

## 9. 새 기능 추가 시 체크리스트

새 기능 아이디어가 떠올랐을 때, 다음 순서로 자문한다:

1. 기존 Content의 새 `kind` 로 표현 가능한가?  → **Content 수정만**
2. 기존 부서의 새 함수로 표현 가능한가?  → **해당 부서의 service.ts에만 추가**
3. 어떤 기존 부서에도 안 맞는가?  → **새 부서 신설 검토** (단, 6개월에 1번 정도가 정상)

3번이 너무 자주 나오면 설계 결함 신호. 1~2번으로 80%가 해결되어야 정상.

---

## 10. 계획된 확장 — Application 부서 (Phase 3+)

전략적 결정 자체는 `PROJECT_BRIEF.md` 의 "전략적 갈림길 — 미디어 vs 플랫폼" 섹션을 참고. 본 섹션은 **그 결정이 "도입"으로 갈 경우, 어떻게 기존 구조를 깨지 않고 흡수할지** 기술한다.

### 도입 조건
PROJECT_BRIEF의 Phase 3 검토 트리거 중 2개 이상 충족 시에만.

### 추가되는 것 — 총 3가지

**(1) posts 테이블에 컬럼 1개 추가**

```
posts.application_mode: 'external' | 'internal'
  default: 'external'   ← 기존 데이터는 자동으로 external
```

**(2) 새 부서 1개 신설**

```
modules/application/   ← 새 폴더
  ├── domain.ts
  ├── repository.ts
  ├── service.ts
  │   ├── submitApplication(userId, postId, data)
  │   ├── listApplications(brandId)        ← 브랜드 어드민용
  │   ├── getApplicationStatus(id)
  │   └── exportToBrand(applicationId)
  └── ui/
      └── ApplicationForm.tsx
```

**(3) 새 테이블 1개**

```
applications
  id
  user_id          → users.id
  post_id          → posts.id
  submitted_data   (JSON: 이름·주소·전화 등 폼 내용)
  status           ('submitted' | 'forwarded' | 'shipped' | 'completed' | 'rejected')
  forwarded_at
  created_at
```

### 의존성 그래프 갱신

```
  UI ──> Application ──> Content (post 정보 참조, 읽기)
                    ──> User    (신청자 정보 참조, 읽기)
```

Application은 Content·User를 **읽기만** 한다. 역방향 의존 없음 — 5장의 6원칙 그대로 유지.

### 기존 코드 영향 — 거의 없음

| 부서 | 영향 |
|------|------|
| Content | 컬럼 1개 추가, 그 외 무수정 |
| Brand, User, Personalization, Curation, Discovery | **무수정** |
| UI (카드 상세 페이지) | `application_mode === 'internal'` 일 때만 신청 폼 노출하는 분기 1개 추가 |

> **시사점:** 회사의 정체성을 바꾸는 큰 전략 변경조차 기존 9개 부서를 거의 건드리지 않고 흡수된다. 이것이 첫 설계가 잘 되었을 때 얻는 가장 큰 이득이다.

---

## 11. 참고 — 이 설계의 출처

- **Domain-Driven Design** (Eric Evans) — Bounded Context 개념
- **Hexagonal Architecture** (Alistair Cockburn) — Ports & Adapters
- **Modular Monolith** (Simon Brown) — 마이크로서비스로 가지 않고도 경계 유지
- 우리는 위 셋의 핵심 규칙만 차용: "경계 + 단방향 의존 + 공개 인터페이스"

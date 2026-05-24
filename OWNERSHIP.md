# 엄빠레이더 — 모듈 오너십 매트릭스

> 작업 요청 시 정확한 "담당자"로 라우팅하기 위한 가이드.
> 모든 담당자는 가상 역할(virtual role)임 — 1인 사업자 + Claude 협업 기준.
> 사용자가 "프론트 담당자에게 ○○ 부탁해" 같이 요청하면, Claude가 해당 담당자 시점에서
> 책임·범위·관련 파일을 즉시 식별하고 작업.

## 한눈에 보기 (담당자 ↔ 모듈 매핑)

| 담당자 (역할) | 책임 영역 | 핵심 폴더 | 주요 외부 의존 |
|---|---|---|---|
| 🎨 **FRONT** | 카드 UI·필터·페이지 레이아웃 | `src/modules/content`, `src/modules/discovery`, `src/app/(web)` | Tailwind, ViewTransition |
| 🛠️ **CURATOR** | 카드 생성·승인·관리자 페이지 | `src/modules/curation`, `src/app/admin` | Supabase Storage, Gemini Vision |
| 🤖 **INGEST** | 자동 수집 cron + AI 정규화 | `src/modules/ingestion`, `src/app/api/cron` | Naver Search API, Gemini Flash |
| 🔐 **AUTH** | 회원가입·로그인·세션·온보딩 | `src/modules/user`, `src/app/(web)/login`, `signup`, `proxy.ts` | Supabase Auth, OAuth |
| 👶 **PROFILE** | 자녀 정보·맞춤 추천·내것 페이지 | `src/modules/personalization`, `src/app/(web)/me`, `my` | children DB |
| 📊 **ANALYTICS** | 이벤트 트래킹·통계 대시보드 | `src/modules/analytics`, `src/app/admin/(private)/stats` | events 테이블 |
| 💰 **ADS** | 광고 슬롯·수익화 | `src/modules/advertising`, `src/modules/monetization` | (미구현, 향후) |
| 🔔 **PUSH** | 푸시 알림 인프라 | `src/modules/notification`, `public/sw.js` | Web Push API, VAPID (Stage 2) |
| 🐻 **BRAND** | 마스코트·로고·스플래시·도메인·자산 | `src/shared/ui/Logo.tsx`, `src/app/*.png`, `src/app/(web)/_components/SplashScreen` | Cloudflare, Vercel |
| 🏗️ **INFRA** | DB 스키마·환경변수·배포·proxy | `supabase/migrations`, `next.config.ts`, `vercel.json`, `proxy.ts` | Supabase, Vercel, Cloudflare |
| 📱 **PWA** | 앱 설치·SW·매니페스트·아이콘 | `src/modules/user/ui/InstallActions`, `public/sw.js`, `src/app/manifest.ts` | Web Manifest, Service Worker |
| 🎁 **TOSS** | 토스 미니앱 별도 프로젝트 | `umbba-radar-toss/` (별도 폴더) | @apps-in-toss/web-framework |

---

## 🎨 FRONT — 카드·필터·페이지 UI

**책임**: 사용자가 보는 화면 (메인 그리드, 카드 디자인, 상세 페이지, 필터). 디자인 시스템 톤 유지.

**Owns**:
- `src/modules/content/` — PostCard, PostCardSkeleton, ContentService
- `src/modules/discovery/` — FilterBar, filterPosts, sortPosts
- `src/app/(web)/page.tsx` — 메인 그리드
- `src/app/(web)/post/[id]/page.tsx` — 카드 상세
- `src/app/(web)/loading.tsx`, `src/app/(web)/post/[id]/loading.tsx` — 스켈레톤
- `src/app/(web)/_components/SplashScreen.tsx` — (BRAND과 공유)
- `src/app/(web)/_components/BottomTabNav.tsx` — 하단 탭
- `src/app/(web)/layout.tsx` — 네비·푸터 레이아웃

**Doesn't own**:
- 인증 UI(LoginForm 등) → AUTH
- 광고 슬롯 → ADS
- 관리자 페이지 → CURATOR

**주요 결정 기록**:
- 이미지 비율: `aspect-[4/5]` (인스타 portrait 표준, 2026-05-24)
- 컨테이너: `max-w-6xl px-4`
- 카드 텍스트 영역 분리 (이미지 위 오버레이 X)
- "본문(post.body)"은 리스트에서 미노출, NEW 배지로 3일 이내 표시

---

## 🛠️ CURATOR — 카드 큐레이션·관리자

**책임**: 카드 등록·수정·삭제·승인. AI 자동 추출 (이미지·URL → 메타). 관리자 페이지.

**Owns**:
- `src/modules/curation/` — actions, repository, ai-extract-actions, PostForm·PostFormWithAI·AIExtractPanel, ImageUploadField
- `src/app/admin/(private)/` — 관리자 페이지 전체
  - `/admin` — 카드 목록·승인·삭제
  - `/admin/new` — 새 카드 작성 (AI 추출 포함)
  - `/admin/[id]/edit` — 수정
  - `/admin/queue` — pending 큐 검토
- `src/app/admin/(auth)/login` — 관리자 로그인 (별도 비밀번호)
- `src/app/admin/(private)/layout.tsx` — 어드민 레이아웃

**Doesn't own**:
- 사용자 인증 → AUTH
- 통계 대시보드 → ANALYTICS
- 자동 수집 (cron) → INGEST (하지만 결과물은 CURATOR pending 큐로 들어옴)

**주요 결정 기록**:
- 모든 외부 입력(자동수집·제보)은 `status=pending`으로 진입 → 관리자 검수 후 `published`
- AI 추출 결과도 `pending` 자동 설정 → 검수 강제
- 이미지 업로드: Supabase Storage `card-images` 버킷
- AI 추출은 Gemini 2.0 Flash multimodal (Vision)

---

## 🤖 INGEST — 자동수집·AI 정규화

**책임**: Naver 블로그 검색 API로 매일 크롤링 → Gemini로 구조화 → pending 큐 자동 적재.

**Owns**:
- `src/modules/ingestion/` — service, normalizer (텍스트), vision-extractor (이미지)
- `src/app/api/cron/ingest/route.ts` — 매일 21:00 KST 실행
- `vercel.json` cron 설정 (INFRA와 공동)

**Doesn't own**:
- AI 추출의 UI/관리자 액션 → CURATOR (`ai-extract-actions.ts`는 CURATOR 폴더에 위치)
- 인스타 자동 크롤링 — **영구 금지** (정책)

**주요 결정 기록**:
- Gemini RPM 15 한도 → 배치 5개씩 + 4.5초 sleep
- 자동수집 cron 결과는 무조건 `pending` (자동 발행 영구 금지)
- 인스타·틱톡 자동 크롤링 영구 금지 (BUSINESS_MODEL.md 정책)
- Naver Search API만 사용 (블로그 검색 결과)
- HEIC·JPG·PNG·WEBP 모두 Gemini Vision 직접 처리 (별도 변환 X)

---

## 🔐 AUTH — 인증·온보딩·게이트

**책임**: 회원가입·로그인·세션 관리. 비로그인 사용자 게이트. 자녀 정보 강제 온보딩.

**Owns**:
- `src/modules/user/` (PROFILE과 공유) — service, actions, EmailAuthForms, SignInButton, ChildrenForm, ViewGate, MigrationOnLogin, UserMenu
- `src/app/(web)/login/*` — 로그인 페이지
- `src/app/(web)/signup/*` — 가입 페이지
- `src/app/(web)/auth/` — OAuth/이메일 인증 콜백
- `src/proxy.ts` — 미들웨어 (로그인+자녀 정보 게이트)
- `src/shared/db/supabase-browser.ts`, `supabase-ssr.ts` — auth 쿠키 처리

**Doesn't own**:
- 자녀 정보 데이터 관리 → PROFILE (개념적 분리)
- 관리자 인증 (별도) → CURATOR

**주요 결정 기록**:
- ViewGate FREE_VIEW_LIMIT = 4 (5번째 카드부터 가입 유도)
- 이메일 로그인 후 `window.location.href` 풀 리로드 (router.push의 쿠키 race condition 회피)
- proxy.ts: 로그인 + 자녀 정보 없으면 `/signup/profile` 강제
- Google OAuth는 env 토글(`NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`)로 비활성 (계정 정지 대응)
- 카카오·네이버 로그인 미구현 (향후)

---

## 👶 PROFILE — 자녀 정보·맞춤 추천

**책임**: 자녀 등록·수정 (다둥이 지원), 부모 역할, 자녀 월령 기반 추천 매칭.

**Owns**:
- `src/modules/personalization/` — service-server, MyPostsList, MigrationOnLogin
- `src/modules/user/ui/ChildrenForm.tsx` — 자녀 정보 폼 (AUTH와 공유)
- `src/app/(web)/me/page.tsx` — 마이페이지 (자녀 수정)
- `src/app/(web)/my/page.tsx` — 내 관심·신청 카드
- `src/app/(web)/signup/profile/page.tsx` — 강제 온보딩

**Doesn't own**:
- 인증·세션 → AUTH
- 카드 데이터 자체 → CURATOR/FRONT

**주요 결정 기록**:
- 다둥이 지원: 한 user_id에 여러 children 행
- 임신중 = gender 'X' + birth_date에 출산예정일
- "임신·육아 시기" 자동 계산은 children.birth_date 기준 + all_ages 항상 포함
- 자녀 정보 저장은 **result return 패턴** (server action에서 redirect X)

---

## 📊 ANALYTICS — 이벤트·통계

**책임**: 사용자 행동 이벤트 기록. KPI(UU, CTR) 대시보드.

**Owns**:
- `src/modules/analytics/` — service, track, ui (CardClickTracker, ExternalLinkButton)
- `src/app/api/track/route.ts` — 이벤트 수신 엔드포인트
- `src/app/admin/(private)/stats/page.tsx` — 대시보드
- `events` 테이블 (Supabase)

**Doesn't own**:
- 광고 노출 로깅 → ADS와 공동 (이벤트는 ANALYTICS, 광고 로직은 ADS)

**주요 결정 기록**:
- 이벤트 종류: card_click, source_link_click, status_mark, filter_change, login_attempt 등
- anon_id (localStorage UUID)로 비로그인도 추적
- RLS: 누구나 insert 가능, 조회는 service_role(관리자)만
- KPI 결정적 지표: CTR (source_link_click / card_click), 15% 이상 양호

---

## 💰 ADS — 광고·수익화

**책임**: 광고 슬롯 (배너·인앱·스폰서드 카드). 토스애즈 픽셀 (향후).

**Owns**:
- `src/modules/advertising/` — AdSlot, AdContext
- `src/modules/monetization/` — (향후 인앱 결제·구독 등)

**Doesn't own**:
- 토스 미니앱 자체 → TOSS

**주요 결정 기록**:
- 광고 한 화면 최대 2개, 카테고리 매칭 필수
- 의료·금융·사행성 거부 (정책)
- 사업자 등록 후에만 활성화 가능 (토스애즈·구글 애드센스)
- 현재 AdSlot은 placeholder

---

## 🔔 PUSH — 푸시 알림 (Stage 2)

**책임**: Web Push 인프라. 구독 관리. 발송 로직. (현재 미구현)

**Owns** (예정):
- `src/modules/notification/` — service, subscribe, send
- `public/sw.js` — Service Worker push 핸들러 (PWA와 공동)
- `push_subscriptions` 테이블 (이미 마이그레이션 009로 생성됨)

**Doesn't own**:
- 이메일·SMS 알림 → **영구 미사용** (정책)

**주요 결정 기록**:
- 알림 방식: **Web Push만**. 이메일·SMS 영구 X (BUSINESS_MODEL.md)
- 진행 시점: MAU 100+ 검증 후
- 필요 작업: VAPID 키 생성, sw.js 확장, 구독 UI, 발송 cron/trigger

---

## 🐻 BRAND — 마스코트·아이덴티티

**책임**: 시각 아이덴티티 (로고·아이콘·스플래시). 도메인 자산. 마케팅 이미지.

**Owns**:
- `src/shared/ui/Logo.tsx` — 인라인 SVG 미니 곰돌이
- `src/app/icon.png`, `apple-icon.png` — PWA·iOS 아이콘
- `public/bear-mascot.png` — 스플래시·SNS용
- `public/toss-thumbnail.png` — 토스 콘솔 썸네일
- `src/app/manifest.ts` — PWA 매니페스트 (PWA와 공유)
- `src/app/(web)/_components/SplashScreen.tsx` — 첫 진입 스플래시 (FRONT와 공유)

**Doesn't own**:
- Tailwind 색상 토큰 자체 → INFRA
- 카드 디자인 디테일 → FRONT

**주요 결정 기록**:
- 마스코트: 안테나에 하트 달린 조그마한 곰
- 슬로건: "엄빠 대신 매일 혜택 스캔 중 ♥"
- 컬러: rose-400 (#FB7185), pink-50 background
- 도메인: umbba-radar.com (Cloudflare Registrar, 2026-05-24)

---

## 🏗️ INFRA — DB·환경·배포

**책임**: 스키마 마이그레이션, 환경변수, 빌드·배포 설정, proxy/미들웨어.

**Owns**:
- `supabase/migrations/*.sql` — DB 스키마 (010까지)
- `.env.local`, Vercel env vars — 환경변수
- `next.config.ts` — 빌드 설정, Server Action body limit
- `vercel.json` — cron 설정 (INGEST와 공동)
- `src/proxy.ts` — Next.js 16 proxy 미들웨어 (AUTH와 공동)
- `src/shared/db/` — Supabase 클라이언트 4종 (anon, browser, ssr, service_role)
- `src/shared/utils/dday.ts`, `relative-time.ts` — KST 시간 유틸

**Doesn't own**:
- 각 모듈 비즈니스 로직 → 해당 담당자

**주요 결정 기록**:
- Next.js 16 + Turbopack + proxy.ts (middleware deprecated)
- Server Action body limit 10MB (인스타 스크린샷 HEIC 5MB+ 대응)
- maxDuration 60s (`/admin/new`에서 Gemini Vision 처리용)
- KST 모든 시간 계산은 +09:00 명시 (`toLocaleString`에 `timeZone: "Asia/Seoul"` 필수)
- Vercel Hobby plan + 도메인 public repo (배포 차단 회피)
- Vercel cron daily 21:00 KST

---

## 📱 PWA — 앱 설치·SW

**책임**: PWA 매니페스트, Service Worker, 앱 설치 진입점.

**Owns**:
- `src/app/manifest.ts` — manifest 정의 (BRAND과 공유)
- `public/sw.js` — Service Worker
- `src/app/(web)/_components/ServiceWorkerRegister.tsx` — SW 등록
- `src/app/(web)/_components/InstallBanner.tsx` — 자동 토스트 배너
- `src/modules/user/ui/InstallActions.tsx` — GNB 칩 + 시트 항목 + 모달

**Doesn't own**:
- 푸시 알림 → PUSH (Stage 2)

**주요 결정 기록**:
- PWA standalone 모드 감지 → 모든 설치 UI 자동 숨김
- iOS Safari → 공유 → 홈 화면 추가 가이드 모달
- Android Chrome `beforeinstallprompt` 이벤트 캐시 + fallback 안내
- 진입점 4곳: 자동 배너 + GNB 데스크탑 + 모바일 헤더 + 더보기 시트

---

## 🎁 TOSS — 토스 미니앱 (별도 프로젝트)

**책임**: 토스 인앱 출시 — Vite + @apps-in-toss/web-framework. Supabase DB 공유.

**Owns**:
- `umbba-radar-toss/` 전체 (별도 폴더, 별도 Vite 프로젝트)
- `granite.config.ts` — 토스 SDK 설정
- TDS Mobile 컴포넌트 활용

**Doesn't own**:
- 웹앱(umbba-radar) — 별도 코드베이스, 공유 자원만 Supabase

**주요 결정 기록**:
- WebView 기반 (Vite 6 + React 18 + TypeScript)
- @apps-in-toss/web-framework v2.6
- Supabase 동일 프로젝트 공유 (DB·RLS)
- 사업자등록증 불필요 (수익화 안 하면)
- 챌린지 "귀여운게 최고야" 출품 예정

---

## 📋 작업 라우팅 가이드 (Claude 사용법)

### 사용자가 작업 요청할 때

**Good (담당자 명시)**:
> "FRONT 담당자에게 카드 그림자 더 진하게 해줘"
> "CURATOR 쪽 AI 추출 프롬프트에 '굿즈' 카테고리 인식 추가"
> "AUTH 쿠키 race condition 다시 봐줘"

→ Claude는 즉시 해당 담당자의 Owns 폴더만 살펴보고 작업.

**Acceptable (작업 내용으로 추론)**:
> "5번째 카드 클릭 시 가입 화면 뜨는 거 한도 다시 늘려줘"

→ Claude가 자동으로 AUTH(ViewGate) 라우팅.

**Cross-team 요청은 명시**:
> "FRONT + CURATOR — 카드에 '광고' 배지 추가하고 PostForm에서 토글 가능하게"

→ 두 담당자 모두 작업, 변경 범위 명확.

### Claude가 작업할 때

1. **요청 받으면**: "이건 어느 담당자 영역?" 자문
2. **해당 담당자 Owns에 있는 파일들만** 우선 손댐
3. **다른 담당자 영역 침범 필요하면** 명시: "X 담당자 영역도 건드리는데 OK?"
4. **공유 영역**(BRAND·INFRA·SHARED) 변경 시 영향 받는 담당자 모두 점검

### 변경 사항 커밋 메시지에 담당자 prefix

```
feat(FRONT): 카드 NEW 배지 3일 → 5일로 조정
fix(AUTH): 이메일 로그인 쿠키 race condition
chore(BRAND): 마스코트 PNG 1.3MB 압축 → 600KB
feat(INGEST): 굿즈 카테고리 Gemini 프롬프트 추가
```

→ 향후 git log 검색 시 담당자별 변경 추적 쉬워짐.

---

## 의존성 그래프 (담당자 간 호출 관계)

```
FRONT ─────→ ANALYTICS (이벤트 기록)
  │
  ├──────→ AUTH (로그인 상태 확인)
  │
  └──────→ PROFILE (자녀 시기 기반 추천 receiver)

CURATOR ──→ INGEST (pending 큐 receiver)
   │
   ├──→ AUTH (관리자 인증 별도)
   │
   └──→ INFRA (Supabase Storage, DB 접근)

INGEST ───→ INFRA (DB·env·cron)

AUTH ─────→ INFRA (Supabase Auth, proxy)
   │
   └──→ PROFILE (자녀 정보 게이트)

PUSH ─────→ AUTH (구독 시 user 식별)
   │
   └──→ INFRA (push_subscriptions 테이블)

BRAND/PWA ─→ FRONT (스플래시·로고·아이콘 노출)
   │
   └──→ INFRA (manifest, env)
```

---

## 향후 추가 예정 담당자

| 담당자 | 진입 시점 | 책임 |
|---|---|---|
| 🔍 **SEARCH** | MAU 500+ | 검색 기능, Elasticsearch/Postgres FTS |
| 💬 **COMMUNITY** | Phase 3 | 댓글·후기 작성·공유 |
| 🎯 **CAMPAIGN** | 사업자등록 후 | 브랜드 직접 협찬·캠페인 관리 |
| 📞 **SUPPORT** | MAU 1000+ | 고객 문의·CS |

---

> 이 문서는 작업 정확도·범위 명확성을 위해 만들어진 살아있는 문서입니다.
> 새 모듈·기능 추가 시 해당 담당자 섹션도 같이 업데이트해주세요.
> 모듈 간 책임 충돌·중복 발생 시 이 문서를 합의의 기준으로 사용.

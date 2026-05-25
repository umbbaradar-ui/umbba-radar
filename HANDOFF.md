# 인수인계서 — 2026-05-25 세션 종료 시점

> **다음 Claude/세션 시작 시 이 문서 + `OWNERSHIP.md` + `AGENTS.md` 먼저 읽으세요.**
> 이번 세션은 PWA 고도화 → SEO 인프라 → 분석 도구 → 분류 체계 → 알림 시스템까지 60+ 커밋 진행. 컨텍스트 무거워서 새 세션 권장.

---

## 🚨 즉시 사용자 액션 대기 중인 것 (가장 중요)

배포는 모두 완료됐지만 **사용자가 외부 콘솔에서 수동으로 처리해야** 할 항목들:

### 1. ~~DB 마이그레이션 3개~~ ✅ 완료 (2026-05-25)

011/012/013 모두 Supabase Dashboard SQL Editor에서 실행 완료.
- 011: type_tags 7→4 (follow/lottery/gov_support 제거, free_trial+experience_group+sponsored → experience)
- 012: topic 컬럼 추가 (parenting/living)
- 013: stage_categories 8→6 (preschool→toddler, elementary_lower+upper → elementary)

후속 정리도 같이 진행됨 (2026-05-25 세션):
- `post.ts`의 deprecated fallback 라벨 일괄 제거 (union·STAGE_LABELS·TYPE_LABELS)
- `stage-visuals.ts`의 deprecated 엔트리 제거
- `service-server.ts`의 `getStageFromBirthDate` 데드코드 제거 (옛 stage 값 반환하던 함수)
- `npm run build` 통과 확인

### 2. ~~검색엔진 콘솔~~ ✅ 완료 (2026-05-25)

Google Search Console + Naver Search Advisor 사이트 등록 + sitemap 제출 완료.
verification 메타태그는 `src/app/layout.tsx:38-43`에 상주 (소스 변경 금지).

### 3. ~~GA4 페이지뷰 태그~~ ✅ 완료 (2026-05-25)

GTM 컨테이너 `GTM-PR2K864P`에 GA4 페이지뷰 태그 등록 + 게시 완료.

### 4. (선택) PWA Screenshots 캡처 — 🔴 대기 중

- 폰에서 메인/카드상세/내 레이더 3장 캡처
- 1080×1920 크롭 후 `public/screenshots/{mobile-home,mobile-card,mobile-my}.png` 업로드
- 가이드: `public/screenshots/README.md`

### 5. (선택) Play Store 등록

- Google Play Console 가입 ($25, 신원인증 + 신용카드)
- pwabuilder.com에서 `https://umbba-radar.com` → Android 패키지 생성
- SHA-256 받아서 Claude에 전달 → `public/.well-known/assetlinks.json` 자동 작성
- 개인 계정은 Closed Testing 20명 14일 필수 (2023.11~ 정책)

---

## 🗺️ 이번 세션 작업 분류 요약

### A. PWA 고도화
- 아이콘 5종 생성 (192/512 any + 192/512 maskable + 180 apple) — `scripts/generate-pwa-icons.mjs`
- 원본은 `assets/bear-mascot-source.png` (1254×1254), 공개 자산은 압축본
- manifest 풀세트: id, scope, shortcuts(4개), screenshots(3개 placeholder), launch_handler, display_override, dir
- PWA 설치 감지 강화: `src/shared/utils/pwa.ts` — display-mode 4종 + iOS standalone + localStorage 폴백
- SplashScreen: PWA 모드 노출 + 슬로건 하단 + 로딩 인디케이터 + 500/700ms 단축

### B. SEO 풀세트
- `src/app/robots.ts` — 공개 인덱싱 허용, 개인화/관리 차단
- `src/app/sitemap.ts` — 정적 5개 + DB published 동적, revalidate 60s
- `/post/[id]/page.tsx` — generateMetadata (카드별 고유 title/desc/OG/canonical) + JSON-LD Article
- `/post/[id]/opengraph-image.tsx` — 카드별 1200×630 OG 이미지 (좌측 썸네일 + 우측 정보)
- root layout: JSON-LD Organization + WebSite, alternates.canonical, robots.googleBot
- 검색엔진 소유권 인증 (Google + Naver) — metadata.verification

### C. 분석
- GTM (`GTM-PR2K864P`) — `next/script` SSR, production만, dev 비활성
- noscript fallback, 환경변수 `NEXT_PUBLIC_GTM_ID` 우선
- 자체 analytics(events 테이블) + GA4 이중 추적 (이중 보내기는 안 함, 분리 운영)

### D. 분류 체계 간소화 (3개 axis)

**type_tags 7→4**:
| 구 (제거/통합) | 신 |
|---|---|
| follow / lottery / gov_support | 제거 |
| free_trial / experience_group / sponsored | → `experience` (체험단) |
| regram | 유지 |
| (신규) kids_model, supporters | 추가 |

**stage_categories 8→6**:
| 구 | 신 |
|---|---|
| pregnancy/newborn/infant/toddler/all_ages | 유지 (newborn 라벨 "출산 직후"→"신생아") |
| preschool | → `toddler` |
| elementary_lower / elementary_upper | → `elementary` |

**topic axis 신규**: `parenting` (육아) / `living` (리빙)
- 기존 카드는 일괄 `parenting`
- AI(Gemini)가 새 카드 분류

~~deprecated 값은 `post.ts` union/labels에 임시 fallback~~ → 2026-05-25 일괄 제거 완료.
`ACTIVE_STAGE_CATEGORIES`, `ACTIVE_TYPE_TAGS`, `ACTIVE_TOPIC_CATEGORIES` 상수로 UI/AI는 신규만 노출.

**stages.ts 월령 매칭 버퍼 재설계**:
```
신생아: -3~6, 영아: 3~15, 유아: 6~90(코어 1~7세+±6), 초등생: 72~168(코어 7~13세+±12)
```

### E. 알림 시스템 + 내 레이더 재설계

**새 컴포넌트/페이지**:
- `/notifications` 페이지 — 자녀 시기 정확 매칭 + 관심 카드 마감 임박
- `NotificationBell` (헤더 우측 벨, 미읽음 빨간 점, localStorage `umbba-notif-last-seen`)
- `NotificationsHeader` (sticky top-0 z-30, 뒤로가기, 토스 스타일)
- `NotificationSeenMarker` (페이지 진입 시 lastSeen 갱신)

**서버 함수 신규** (`src/modules/personalization/service-server.ts`):
- `getRecentMatchingCards(limit)` — 자녀 시기 정확 매칭 (all_ages 제외) + 최근 14일
- `getInterestedDeadlineSoon()` — 관심 카드 중 7일 이내 마감
- `getNotifications()` — 위 둘 통합, 마감 임박 우선

**/my 3탭 재설계** (`MyRadarTabs.tsx`):
- 관심: "찜한 카드 · 마감 임박 시 알림 보내드려요 🔔"
- 신청함: "신청 완료! 좋은 결과를 바라요 ♥"
- 과거 레이더: expired 카드 중 관심/신청, 월별 그룹핑

**시기별 시각화** (`src/shared/utils/stage-visuals.ts`):
임신중🤰 / 신생아👶 / 영아🍼 / 유아🧸 / 초등생🎒 / 전연령🏠

**명칭**: "내것" → "내 레이더" (BottomTabNav, 데스크탑 nav, manifest shortcuts)

### F. 성능 / 버그픽스
- `next.config.ts`: images.formats AVIF/WebP, deviceSizes 슬림
- bear-mascot.png 1.3MB → 29KB (300×300)
- toss-thumbnail.png 1295KB → 234KB
- BottomTabNav 스크롤 따라가는 버그: body `flex flex-col` → `min-h-dvh` (block), sticky footer는 (web)/layout wrapper로 이전

### G. 브랜드/카피
- title/OG/Twitter 통일: "엄빠레이더 — 엄빠 대신 매일 혜택 스캔 중 ♥"
- description은 "놓치는 혜택은 없게..." 유지 (기능적 카피)

---

## 🎯 정책 결정사항 (영구 적용)

| 항목 | 결정 |
|------|------|
| 자녀 시기 매칭 (알림) | `all_ages` 제외 — 진짜 맞춤만 |
| 자녀 시기 매칭 (메인 필터) | `all_ages` 포함 |
| 푸시 알림 | Web Push는 MAU 100+ 후 (Stage 2, PUSH 담당자) — 지금은 인앱만 |
| GTM 운영 | dev 환경 비활성, production만 |
| console.log/error | 서버 사이드 에러 로그는 유지 (Vercel 디버깅용) |
| screenshots | Play Console UI에 별도 업로드 (manifest는 부가) |
| 분류 변경 시 | 마이그레이션 SQL + deprecated fallback 동시 → 무중단 |
| 커밋 메시지 | 한국어, 담당자 prefix (`feat(FRONT,PROFILE): ...`), HEREDOC |
| **자동 커밋·푸시** | 빌드 성공 후 묻지 말고 자동 (사용자 피드백 — `~/.claude/.../memory/feedback_auto_commit_push.md`) |

---

## 🔮 미해결 / 다음 단계 옵션

### 작은 follow-up (단순 작업)
- [x] ~~`post.ts`의 deprecated stage/type 라벨 제거~~ (2026-05-25 완료)
- [ ] PWA shortcuts 각각 다른 96×96 아이콘 디자인 (지금은 모두 앱 아이콘 fallback)
- [ ] screenshots 3장 사용자 캡처 → 매니페스트 검증 통과
- [x] ~~GA4 측정 ID 발급 후 GTM에 페이지뷰 태그 추가~~ (2026-05-25 완료)

### 중간 작업 (의사결정 필요)
- [ ] `share_target` manifest 추가 + `/submit` prefill 처리 (인스타 → 공유 → 제보 자동)
- [ ] proxy.ts children 조회 캐싱 (페이지 네비 -50~100ms, AUTH 로직 변경 위험 중)
- [ ] PostCard 블러 백드롭 제거 검토 (렌더 비용, 디자인 영향)
- [ ] 마감 미정 카드 노출 기간 관리자 입력화 (현재 7일 하드코딩)

### 큰 작업 (별도 의논 필요)
- [x] ~~Web Push 인프라~~ (2026-05-25 풀세트 도입 완료 — Stage 2 → Stage 1로 앞당김)
- [ ] Play Store 등록 (개인 계정, $25, Closed Testing 20명 14일)
- [ ] iOS App Store ($99/년, PWA→iOS는 까다로움, 토스 미니앱 트랙이 더 현실적일 수도)
- [ ] Search Console 등록 후 데이터 분석 (4~8주 누적 후)
- [ ] 신청함 → 당첨함 상태 추가 + 후기 작성 유도

---

## 🛠️ 다음 세션이 알아야 할 기술 컨텍스트

### Next.js 16 특이사항 (AGENTS.md 참조 필수)
- Turbopack + `proxy.ts` (middleware 이름 deprecated)
- App Router 메타데이터 파일 컨벤션 적극 활용 (`robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`)
- ViewTransition (React 19.2) — PostCard에 사용 중

### 환경 변수 (`.env.local` + Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `ADMIN_ID`, `ADMIN_PASSWORD`
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- `NEXT_PUBLIC_GTM_ID` (선택 — 미설정 시 코드 기본값 `GTM-PR2K864P`)
- `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` (현재 비활성)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Web Push)
- `CRON_SECRET` (Vercel cron 인증 — ingest + notify-deadline 공유)

### DB (Supabase) 마이그레이션 현황
- 015까지 모두 실행 완료 (2026-05-25)
- 014: `posts.deadline_unknown` boolean — 마감 미정 카드 처리
- 015: `posts.search_keywords` TEXT + pg_trgm + GIN trigram 인덱스 4종 — 동의어 검색

### Vercel
- Hobby plan, cron 2개 (Vercel cron 표준 = UTC 기준):
  - `/api/cron/ingest` — `0 21 * * *` UTC = **06:00 KST** (핸드오프 초안 "21:00 KST" 표기는 사실 UTC 시간이었음 — INFRA 검토 권장)
  - `/api/cron/notify-deadline` — `0 0 * * *` UTC = **09:00 KST** (마감 1일 전 카드 푸시 발송)
- Server Action body limit 10MB
- maxDuration 60s (cron route는 300s까지 가능)

### Repo
- GitHub `umbbaradar-ui/umbba-radar` (public, Vercel 자동 배포)
- 도메인 `umbba-radar.com` (Cloudflare Registrar)

---

## 💬 사용자 작업 스타일 (Claude 협업 팁)

- **빠른 진행 선호**: 너무 많이 묻지 말고 합리적 default로 진행 → 결과 보고 시점에 옵션 명시
- **AskUserQuestion**: 정말 의견 갈리는 디자인/정책만. 기술 디테일은 알아서 판단
- **빌드 검증 후 자동 커밋·푸시 필수** — 사용자에게 git 명령 요청하지 말 것 (이전 피드백)
- **커밋 메시지**: 한국어, 담당자 prefix, HEREDOC로 멀티라인 안전 처리
- **마이그레이션 같은 사용자 액션 필요한 것**: 끝에 🔴 강조해서 명확히 안내
- **풀세트 vs MVP**: 사용자가 풀세트 선호 (다만 작업량 큰 건 옵션 제시 후 결정)
- **컨텍스트 60% 넘으면 새 세션 권장** + 이 HANDOFF.md 갱신
- **이번 세션 보존된 메모리** (`~/.claude/.../memory/feedback_auto_commit_push.md`): umbba-radar 작업 시 빌드 후 자동 커밋·푸시까지 묻지 말 것

---

## 📂 핵심 파일 빠른 참조

| 영역 | 파일 |
|------|------|
| 매니페스트 | `src/app/manifest.ts` |
| robots/sitemap | `src/app/robots.ts`, `src/app/sitemap.ts` |
| GTM/SEO 메타 | `src/app/layout.tsx` |
| 알림 페이지 | `src/app/(web)/notifications/` (page.tsx + _components/NotificationsList.tsx) |
| 알림 서버 함수 | `src/modules/personalization/service-server.ts` (getNotifications/getRecentMatchingCards/getInterestedDeadlineSoon) |
| Web Push 모듈 | `src/modules/notification/` (push-service.ts + actions.ts + ui/PushToggle.tsx) |
| Web Push cron | `src/app/api/cron/notify-deadline/route.ts` |
| Service Worker | `public/sw.js` (push + notificationclick 핸들러) |
| 내 레이더 | `src/app/(web)/my/page.tsx` + `src/modules/personalization/ui/MyRadarTabs.tsx` |
| 시기 매칭 | `src/shared/utils/stages.ts` + `src/shared/utils/stage-visuals.ts` |
| PWA 감지 | `src/shared/utils/pwa.ts` |
| AI 프롬프트 | `src/modules/ingestion/normalizer.ts`, `vision-extractor.ts` |
| 타입 정의 | `src/shared/types/post.ts` |
| 마이그레이션 | `supabase/migrations/011/012/013/014_*.sql` |
| 아이콘 생성 스크립트 | `scripts/generate-pwa-icons.mjs` |

---

## 🔄 이번 세션(2026-05-25 후반) 추가 변경 요약

1. **`stages.ts` newborn 출산 전 버퍼 제거** (`minMonths: -3 → 0`)
   - 임신 중 부모가 신생아 전용 카드 매칭에서 제외 (신청 조건 "이미 태어난 아기" 케이스 보호)
2. **알림 시스템 4종 개선** (`getRecentMatchingCards`/`getInterestedDeadlineSoon`/`NotificationsList`)
   - 마감 임박 7→3일, 가입 이후 카드만, 같은 D-day 내 아이 매칭 우선, 본 항목 페이드
3. **Web Push 풀세트** (notification 모듈 신규 + sw.js 확장 + /me 토글 + notify-deadline cron)
   - 마감 1일 전 자동 푸시. 사용자 수동 옵트인. iOS 16.4+ PWA 안내.
4. **마감일 미정 카드 처리** (마이그레이션 014 + PostForm 체크박스 + PostCard/상세 안내 + AI 통합)
   - 등록 +7일 자동 종료. UI에 `~D-N` amber 톤. 푸시 알림 제외. AI 추출 실패도 동일 처리.
5. **루트 OG 이미지에 곰돌이 마스코트** (`src/app/opengraph-image.tsx`)
   - ♥ 텍스트 → bear-mascot.png. node:fs + base64 data URL (runtime=nodejs).
   - SNS 공유 미리보기에 일관된 브랜드 정체성. 캐시는 각 플랫폼 디버거로 무효화.
6. **`form` type_tag 추가** (post.ts + normalizer + vision-extractor)
   - 네이버폼/구글폼/자체폼 식별 — DB 마이그레이션 불필요(TEXT[]).
   - AI에 "댓글·DM은 form 아님" 명시. 다른 태그와 직교 조합 가능.
7. **검색 동의어 매칭** (마이그레이션 015 + 4컬럼 OR + AI 자동 동의어)
   - `search_keywords` 컬럼 + pg_trgm + GIN trigram 인덱스 4종.
   - 관리자 폼에 "검색 키워드" textarea (콤마 구분). AI가 1~3개 자동 생성.
   - 4컬럼 OR(title/brand/body/search_keywords) ILIKE 매칭.

---

> 이 문서는 살아있는 인수인계서입니다. 다음 세션에서 변경된 정책·완료된 액션은 갱신 또는 제거해주세요.
> 마지막 갱신: 2026-05-25 (015 실행 완료 + OG 곰돌이·form 태그·검색 동의어까지 반영)

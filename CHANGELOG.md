# 변경 이력 (CHANGELOG)

본 파일은 배포 단위(버전)로 변경을 정리합니다. 근거 감사 리포트: `docs/APP-AUDIT-2026-06-14.md`.

---

## [0.2.0] — 2026-06-14 · 출시 전 보안·버그·UX 하드닝

> 전체 감사(`docs/APP-AUDIT-2026-06-14.md`) 결과를 토대로 한 **출시 직전 개선 릴리스**.
> 정책 변경 없음 — 전부 "문제점 개선". 적대적 보안 재검증 통과.

### 🔒 보안 (Security)
- **관리자 인증 재설계** — 쿠키에 평문 `ADMIN_PASSWORD` 저장 제거 → **HMAC 서명 토큰**(`shared/utils/admin-session.ts`). 모든 비교 `crypto.timingSafeEqual`(상수시간), 로그인 실패 시 지연(브루트포스 완화). 검증 9곳(curation·business·ingestion·user·admin layout·import-results·export-todo) **단일 유틸로 일원화**. 새 env 불필요(없으면 `ADMIN_PASSWORD` 재사용, `ADMIN_SESSION_SECRET` 있으면 우선).
- **SSRF 차단** — `extractFromUrl`의 URL/og:image fetch를 `safeFetchText`/`safeFetchBytes`(`shared/utils/safe-fetch.ts`)로 교체. 사설/루프백/링크로컬(169.254.169.254)·NAT64·IPv4매핑 IPv6 차단 + 리다이렉트 hop 재검증 + **헤더·본문 모두 타임아웃** + 8MB 스트리밍 상한.
- **오픈 리다이렉트(피싱) 차단** — 로그인/온보딩/OAuth·이메일 콜백의 `next` 전부 `safeNext`(`shared/utils/safe-next.ts`)로 내부 경로만 허용.
- **공개 anon INSERT RLS 잠금** — `posts`·`business_inquiries`의 미사용 anon INSERT 정책 제거(신원 위조·텍스트 스팸 차단). ※ **마이그레이션 020 수동 적용 필요**.
- **`/api/track` 입력 검증** — 무인증 엔드포인트에 event_name 형식·길이, properties 2KB 상한, anon_id/post_id 길이 제한(DB 폭주 방지).

### 🐞 버그 수정 (Bug Fixes)
- **임신중 월령 계산** — 일(day) 보정 추가. 예정일이 당월 미래일 때 임신부에게 신생아 카드가 오추천되던 문제 해결(`shared/utils/stages.ts`).
- **마감 임박 D-day 불일치** — `Math.ceil(시각차)` → `calcDDay`(KST 자정). 카드의 D-day 배지와 "마감 N일 전" 텍스트 불일치·경계 1일 오차 제거(`personalization/service-server.ts`).
- **온보딩 게이트 fail-open** — `proxy.ts`가 children 조회 오류를 "자녀 없음"으로 오판해 사용자를 온보딩에 가두던 위험 제거.
- **체크전환 KPI 오염** — 낙관적 업데이트 롤백 시 `status_mark` 이벤트가 잘못 기록되던 문제 수정(`StatusButtons`).

### ✨ UX (모바일 우선 검증 완료)
- **카드 공유 버튼 역할별 카피** — 엄마→"남편한테 보내기", 아빠→"아내한테 보내기", 비로그인/기타→"공유하기".
- **홈 "오늘의 스캔" 배너** — 자녀 시기 맞춤 신규 건수 + 마감 임박 칩(daily loop 시각화). 모바일 잘림 수정.
- **ViewGate 개선** — 5번째 카드에서 강제 리다이렉트(본문 깜빡임) → 인페이지 바텀시트(블러+CTA, 스크롤 잠금).
- **로그인/가입 비밀번호 표시 토글**, **검색 제출 버튼**(돋보기 클릭), **비로그인 "이 기기에만 저장" 안내**, **더보기 시트 `inert`**(닫힘 시 포커스 누수 차단).

### ⚡ 성능·기술 (Performance/Tech)
- `getCurrentUser`를 `React.cache`로 — 한 요청 내 `auth.getUser` 중복 호출 제거.
- 피드 기본 `limit` 100→300(스톱갭) — 카드 누적 시 조용한 누락 완화.
- `deletePost`가 Storage(card-images) 객체도 best-effort 정리 — orphan 이미지 방지.

### 🚀 배포 전 필수 액션 (Ops — 코드 외, 운영자 처리)
1. **마이그레이션 020 적용** — Supabase SQL Editor에서 `supabase/migrations/020_lock_posts_insert.sql` 실행 후 `/submit`·`/business` 제출 1회 확인.
2. **VAPID 키 등록** — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`를 Vercel env에 등록 후 재배포(Web Push 점화).
3. **강한 관리자 자격증명** — `ADMIN_PASSWORD`(현재 약함)와 가급적 별도 `ADMIN_SESSION_SECRET`를 강한 랜덤 값으로 Vercel env에 설정. ⚠️ 배포 후 기존 관리자 세션은 무효화되어 `/admin` **재로그인 필요**(CLI Bearer는 영향 없음).

### 📌 후속(이번 버전 제외, 감사 보고 참조)
- 공개 쓰기 IP 레이트리밋(Upstash/Vercel KV) · 레이아웃 `getNotifications` 경량화 · 피드 select 컬럼 최소화 · keyset 페이지네이션 · "받았어요" 토글/후기(020 외 신규 마이그레이션, 사전 공유).

---

## [0.1.0]
- 초기 큐레이션 미디어 MVP(웹/PWA + 토스 미니앱 트랙) · 인스타 로컬 수집 파이프라인 · 관리자 승인 큐 · 자녀 시기 매칭 · 알림 인프라.

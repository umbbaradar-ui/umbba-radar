# 배포 후 본인이 해야 할 설정

이 문서는 코드 푸시만으로는 자동화할 수 없는 설정들을 모았어요. **순서대로** 진행하세요.

> 🔄 이 문서는 코드 진척에 따라 갱신됩니다. 마지막 갱신: 2026-05-23

---

## ✅ 체크리스트 (한눈에)

- [ ] **1. 관리자 ID/PW** — Vercel env var 추가
- [ ] **2. Supabase 마이그레이션 003~007 실행** ← 본인이 빠지신 항목 가능성 높음
- [ ] **3. Supabase Storage 버킷 확인** (007 실행 시 자동 생성)
- [ ] **4. PWA 설치 테스트** (자동, 확인만)
- [ ] **5. OG 이미지 확인** (자동, 확인만)
- [ ] (선택) 6. 구글 로그인 활성화
- [ ] (선택) 7. 사용자 정의 도메인
- [ ] (출시 직전) 8. 약관·개인정보 법무 검토

---

## 1. 관리자 아이디·비밀번호 설정 (필수)

`/admin` 페이지는 **아이디 + 비밀번호** 2단 인증입니다.

### 로컬 (.env.local) — 이미 설정됨
다음 두 줄이 이미 `.env.local` 끝에 추가돼 있어요:
```
ADMIN_ID=admin
ADMIN_PASSWORD=1234
```

> ⚠️ `1234`는 **임시값**. 출시 전에 반드시 강한 값으로 교체하세요 (예: 16자 이상 영문·숫자·특수문자).

### Vercel (배포본에 적용하려면 필수)
1. https://vercel.com/dashboard → `umbba-radar` 프로젝트 → **Settings** → **Environment Variables**
2. **Add New** 를 두 번 반복해서 두 개 추가:
   - Key: `ADMIN_ID` / Value: `admin` / Environments: Production·Preview·Development 모두 체크
   - Key: `ADMIN_PASSWORD` / Value: `1234` / 동일하게 모두 체크
3. Save
4. 좌측 **Deployments** → 최신 배포 옆 점 3개 → **Redeploy** (env 변경은 재배포 필요)

### 확인
- 로컬: `npm run dev` 재시작 후 `http://localhost:3000/admin/login` → 아이디 `admin` / 비밀번호 `1234` 입력 → 대시보드 이동
- 배포본: Vercel env 등록 + Redeploy 후 `https://umbba-radar.vercel.app/admin/login` 동일

---

## 2. Supabase 마이그레이션 실행 (필수, 가장 중요)

`supabase/migrations/` 폴더의 SQL 파일 7개를 **순서대로** Supabase SQL Editor에 붙여넣어 실행합니다.

### 위치
https://supabase.com/dashboard → `umbba-radar` 프로젝트 → 좌측 **SQL Editor** → **New query**

### 실행 순서

| # | 파일 | 효과 | 필수? |
|---|------|------|------|
| 001 | `001_initial_schema.sql` | posts·user_post_status 테이블 + RLS | ✅ 필수 (보통 이미 실행됨) |
| 002 | `002_seed_data.sql` | 시드 카드 3개 (테스트용) | 선택 (003으로 덮어씀) |
| 003 | `003_clean_and_richer_seed.sql` | 시드 정리 + 15개 다양한 카드 | ✅ 강력 추천 |
| 004 | `004_events_table.sql` | Analytics events 테이블 + RLS | ✅ 필수 (트래킹 시작) |
| 005 | `005_source_type_and_submitter.sql` | source_type·제보자 컬럼 + 제보 RLS | ✅ 필수 (/submit 폼 동작) |
| 006 | `006_realistic_unsplash_images.sql` | 시드 썸네일을 Unsplash 실사진으로 | ✅ 권장 (디자인 개선) |
| 007 | `007_storage_bucket.sql` | 이미지 업로드 Storage 버킷 | ✅ 필수 (이미지 업로드 동작) |

### 실행 방법 (각 파일마다 반복)

1. VS Code에서 `supabase/migrations/00X_xxx.sql` 열기
2. **Ctrl+A → Ctrl+C** 전체 복사
3. Supabase SQL Editor 우측 패널의 기존 쿼리 **모두 삭제** → 붙여넣기
4. 우측 상단 **Run** (또는 Ctrl+Enter)
5. 하단에 `Success` 메시지 확인 → 다음 파일로

### 검증
- **Table Editor** 들어가서 다음 테이블이 보이는지:
  - `posts` (15행 정도 — 003 이후)
  - `user_post_status`
  - `events`
- **Storage** 들어가서 `card-images` 버킷이 보이는지 (007 이후)

> 에러 나면 메시지 그대로 복붙해서 알려주세요.

---

## 3. PWA 홈 화면 설치 (자동 적용됨, 본인 확인만)

코드 푸시되면 자동으로 활성화돼 있어요. 확인 방법:

### 안드로이드 크롬
1. 배포된 사이트 접속
2. 주소창 우측 점 3개 → **앱 설치** 또는 **홈 화면에 추가**
3. 홈 화면에 분홍 레이더 하트 아이콘 생김 → 클릭하면 풀스크린

### 아이폰 사파리
1. 사이트 접속
2. 하단 공유 버튼 → **홈 화면에 추가**
3. 홈 화면 아이콘 → 풀스크린 앱처럼 동작

> 아이콘은 임시 디자인(분홍 동심원 + 흰 하트). 본인이 별도 이미지 준비되면 `src/app/icon.tsx` 와 `src/app/apple-icon.tsx` 를 PNG로 교체 가능.

---

## 4. OG 이미지 (SNS 공유 미리보기) — 자동, 확인만

코드에 `src/app/opengraph-image.tsx` 가 있어 자동 생성됩니다.

### 확인 방법
1. https://www.opengraph.xyz/ 접속
2. URL 입력: `https://umbba-radar.vercel.app`
3. **레이더 + "엄빠레이더" 큰 배너** 가 보이면 정상

### 캐시 무효화
페북·카톡은 OG 이미지를 캐시합니다. 디자인 바꾼 직후엔:
- 페북: https://developers.facebook.com/tools/debug/ → Scrape Again
- 카톡은 캐시 무효화 도구 없음 → 도메인 끝에 `?v=2` 같은 쿼리 붙여서 다시 공유

---

## 5. 구글 로그인 활성화 (선택)

코드는 다 준비돼 있는데, Supabase 대시보드 + Google Cloud Console 설정 2단계가 필요해요. **30분 정도 소요.**

### 5.1 Google Cloud Console에서 OAuth 클라이언트 만들기

1. https://console.cloud.google.com/ 접속
2. 프로젝트 새로 만들기 (이름: `umbba-radar`)
3. 좌측 메뉴 **APIs & Services** → **OAuth consent screen**
   - User Type: **External**
   - App name: `엄빠레이더`
   - User support email: 본인 이메일
   - Developer contact: 본인 이메일
   - Save and Continue → Scopes (그대로 두기) → Test users (본인 이메일 추가) → Save
4. **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `umbba-radar`
   - **Authorized redirect URIs**: 다음 URL을 정확히 추가 (Supabase가 알려주는 URL)
     - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
   - Create
5. 화면에 뜨는 **Client ID** 와 **Client Secret** 복사해두기

### 5.2 Supabase에서 Google Provider 활성화

1. https://supabase.com/dashboard → `umbba-radar` 프로젝트 → 좌측 **Authentication** → **Providers**
2. **Google** 찾아서 토글 ON
3. **Client ID (for OAuth)**: 위에서 받은 Client ID 붙여넣기
4. **Client Secret (for OAuth)**: 위에서 받은 Client Secret 붙여넣기
5. 상단에 표시되는 **Callback URL** 을 복사해서 Google Cloud Console의 Authorized redirect URIs에 정확히 일치하는지 확인
6. Save

### 5.3 Site URL 설정

Supabase **Authentication** → **URL Configuration**:
- **Site URL**: `https://umbba-radar.vercel.app`
- **Redirect URLs** (한 줄씩):
  - `http://localhost:3000/auth/callback`
  - `https://umbba-radar.vercel.app/auth/callback`

### 5.4 확인
배포된 사이트 → 우측 상단 **로그인** 버튼 → 구글로 계속하기 → 로그인 완료 후 메인으로 돌아옴 + 우측 상단에 본인 이름 + 로그아웃 버튼 보이면 성공.

> 참고: 신청함·관심 체크는 **여전히 로컬스토리지에 저장**됩니다. Phase 2에서 로그인 사용자 데이터를 Supabase `user_post_status` 테이블로 이관할 예정.

---

## 6. 토스 미니앱 (별도 프로젝트로 진행 예정)

조사 결과 **토스 SDK(`@apps-in-toss/web-framework`)는 Vite 전용**이라 현재 Next.js 프로젝트에 통합 불가능. **별도 Vite 프로젝트**로 만들어야 함.

자세한 결정 사항은 `src/app/(toss)/README.md` 참고.

진행 시 순서:
1. 부모 폴더에서 `npx create-ait-app umbba-radar-toss`
2. 토스 콘솔에서 앱 등록 + 샌드박스 앱 설치
3. Supabase URL·anon key를 토스 앱 환경변수에 추가
4. 카드 그리드·상세 페이지를 Vite + React로 다시 작성 (Supabase는 그대로 호출)
5. 토스 콘솔에서 빌드 업로드 + 검수 요청

이건 1~2일 작업. **Phase 1 정상 출시 후 별도 작업**으로 진행 권장.

---

## 7. 사용자 정의 도메인 (선택)

`umbba-radar.vercel.app` 대신 `umbba-radar.com` 등 사용하고 싶다면:

1. 도메인 구입 (가비아·Cloudflare·Namecheap)
2. Vercel → 프로젝트 → **Settings** → **Domains** → Add
3. 도메인 등록업체에서 DNS 설정 (Vercel이 알려주는 A·CNAME 레코드)
4. 5~30분 후 HTTPS 자동 발급 완료
5. **`src/app/layout.tsx` 의 `metadataBase` 도 새 도메인으로 갱신** (OG 이미지 URL용)

---

## 8. 약관·개인정보처리방침 (출시 직전 필수)

`/terms`·`/privacy` 페이지는 이미 **초안 상태**로 만들어져 있어요. 정식 출시 전 다음을 처리:

1. **법무 검토** — 본인이 실제 수집하는 데이터·서비스 약관 정확한지 변호사·법률 자문 또는 termsfeed.com 같은 생성기로 갱신
2. **운영자 연락처 명시** — 두 페이지 모두 마지막에 "운영자 연락처" 비어 있음
3. **사업자등록증 발급 시** 추가 정보 명기 (상호·대표자·주소·연락처·통신판매업 신고번호)
4. **Google OAuth consent screen** 에 두 페이지 URL 입력 (https://umbba-radar.vercel.app/terms, /privacy)

---

## 자주 막히는 곳

| 증상 | 원인 | 해결 |
|------|------|------|
| 배포는 됐는데 옛 페이지가 보임 | Vercel 빌드 실패 누적 | `vercel ls` 로 상태 확인 → 본인 GitHub 레포 Public 여부 확인 |
| `/admin` 로그인 안 됨 | ADMIN_ID·ADMIN_PASSWORD env var 누락 | Vercel Settings → Environment Variables 확인 |
| `/submit` 폼 제출 시 RLS 에러 | 005 마이그레이션 미실행 | Supabase SQL Editor에서 005 실행 |
| 이미지 업로드 시 "버킷 없음" 에러 | 007 마이그레이션 미실행 | Supabase SQL Editor에서 007 실행 |
| 카드 클릭·체크가 events에 안 쌓임 | 004 마이그레이션 미실행 | Supabase SQL Editor에서 004 실행 |
| 카드가 placeholder 색상으로 보임 | 006 마이그레이션 미실행 | Supabase SQL Editor에서 006 실행 |
| OG 이미지가 옛 디자인 | 카톡·페북 캐시 | URL 끝에 `?v=N` 추가 또는 페북 디버거 |

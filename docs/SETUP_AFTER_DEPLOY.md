# 배포 후 본인이 해야 할 설정

이 문서는 코드 푸시만으로는 자동화할 수 없는 설정들을 모았어요. 순서대로 진행하세요.

---

## 1. 관리자 비밀번호 설정 (Track A — 필수)

`/admin` 페이지에 접근하려면 환경변수 한 개를 더 설정해야 해요.

### 로컬 (.env.local)
프로젝트 루트의 `.env.local` 파일을 열고 한 줄 추가:
```
ADMIN_PASSWORD=원하는강력한비밀번호
```

### Vercel
1. https://vercel.com/dashboard → `umbba-radar` 프로젝트 → **Settings** → **Environment Variables**
2. **Add New**
   - Key: `ADMIN_PASSWORD`
   - Value: 위에서 정한 비밀번호 (같은 값)
   - Environments: Production, Preview, Development 전부 체크
3. Save
4. 좌측 **Deployments** → 최신 배포 옆 점 3개 → **Redeploy** (env 변경은 재배포 필요)

확인: `https://umbba-radar.vercel.app/admin/login` 접속 → 비밀번호 입력 → 카드 관리 페이지로 이동되면 성공.

---

## 2. 구글 로그인 활성화 (Track B — 선택)

코드는 다 준비돼 있는데, Supabase 대시보드 + Google Cloud Console 설정 2단계가 필요해요. **30분 정도 소요.**

### 2.1 Google Cloud Console에서 OAuth 클라이언트 만들기

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

### 2.2 Supabase에서 Google Provider 활성화

1. https://supabase.com/dashboard → `umbba-radar` 프로젝트 → 좌측 **Authentication** → **Providers**
2. **Google** 찾아서 토글 ON
3. **Client ID (for OAuth)**: 위에서 받은 Client ID 붙여넣기
4. **Client Secret (for OAuth)**: 위에서 받은 Client Secret 붙여넣기
5. 상단에 표시되는 **Callback URL** 을 복사해서 Google Cloud Console의 Authorized redirect URIs에 정확히 일치하는지 확인
6. Save

### 2.3 Site URL 설정

Supabase **Authentication** → **URL Configuration**:
- **Site URL**: `https://umbba-radar.vercel.app`
- **Redirect URLs** (한 줄씩): 
  - `http://localhost:3000/auth/callback`
  - `https://umbba-radar.vercel.app/auth/callback`

### 2.4 확인
배포된 사이트 → 우측 상단 **로그인** 버튼 → 구글로 계속하기 → 로그인 완료 후 메인으로 돌아옴 + 우측 상단에 본인 이름 + 로그아웃 버튼 보이면 성공.

> 참고: 신청함·관심 체크는 **여전히 로컬스토리지에 저장**됩니다. Phase 2에서 로그인 사용자 데이터를 Supabase `user_post_status` 테이블로 이관할 예정.

---

## 3. PWA 홈 화면 설치 (Track C — 자동 적용됨, 본인 확인만)

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

## 4. 토스 미니앱 (Track D — 별도 프로젝트로 진행 예정)

조사 결과 **토스 SDK(`@apps-in-toss/web-framework`)는 Vite 전용**이라 현재 Next.js 프로젝트에 통합 불가능. **별도 Vite 프로젝트**로 만들어야 함.

자세한 결정 사항은 `src/app/(toss)/README.md` 참고.

진행 시 순서:
1. 부모 폴더에서 `npx create-ait-app umbba-radar-toss`
2. 토스 콘솔에서 앱 등록 + 샌드박스 앱 설치
3. Supabase URL·anon key를 토스 앱 환경변수에 추가
4. 카드 그리드·상세 페이지를 Vite + React로 다시 작성 (Supabase는 그대로 호출)
5. 토스 콘솔에서 빌드 업로드 + 검수 요청

이건 1~2일 작업이라 챌린지 마감(5/24)에는 못 맞춤. **Phase 1 정상 출시 후 별도 작업**으로 진행 권장.

---

## 5. 사용자 정의 도메인 (선택)

`umbba-radar.vercel.app` 대신 `umbba-radar.com` 등 사용하고 싶다면:

1. 도메인 구입 (가비아·Cloudflare·Namecheap)
2. Vercel → 프로젝트 → **Settings** → **Domains** → Add
3. 도메인 등록업체에서 DNS 설정 (Vercel이 알려주는 A·CNAME 레코드)
4. 5~30분 후 HTTPS 자동 발급 완료

---

## 6. 약관·개인정보처리방침 (출시 직전 필수)

Google OAuth 활성화 시 OAuth consent screen에 약관·개인정보처리방침 URL을 요구함. 출시 직전에:
- `/terms` 페이지
- `/privacy` 페이지
- 푸터에 링크

법적 의무이기도 함. 양식은 무료 생성기 활용 가능 (예: termsfeed.com).

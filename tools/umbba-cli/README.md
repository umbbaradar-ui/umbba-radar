# umbba-cli — 인스타 게시물 자동 등록 CLI

운영자 PC에서 실행. 인스타 게시물 URL → 자동 다운로드 + Claude/Gemini 분류 + 엄빠레이더 pending 카드 자동 생성.

본인 IP 사용으로 Vercel 서버보다 인스타 차단 위험이 훨씬 낮음.

---

## 두 가지 모드

### 모드 ① 큐 폴링 (`--pull`) — 권장 운영 방식

```
[웹 /admin/bulk-ingest]
  ↓ 와이프/너님이 URL 리스트 textarea 에 일괄 등록
  ↓ ingest_queue 테이블에 todo 로 저장 (중복 자동 제거)

[너님 PC — Windows 작업 스케줄러로 1시간마다 자동 실행]
  py ingest.py --pull --limit 5
  ↓ 서버에서 todo 5개 fetch (processing 으로 마킹)
  ↓ gallery-dl 로 인스타 이미지 + 캡션 다운로드
  ↓ Vercel API POST → Claude Vision 분류 → status=pending 카드 생성
  ↓ 완료 보고 (done/duplicate/failed)

[웹 /admin/queue]
  ↓ pending 카드 검수 → 발행
```

### 모드 ② 파일 모드 (수동) — 디버깅·일회성

```
$ py ingest.py urls.txt   # urls.txt 의 URL 한 줄씩 처리
```

큐 미경유 → 결과는 카드 생성으로 끝 (큐 상태 갱신 X).

---

## 설치 (1회만)

### 1. Python 3.10+ 확인
```powershell
PS> py --version
Python 3.14.5
```

없으면 https://www.python.org/downloads/ 에서 설치.

### 2. 패키지 설치
```powershell
PS> cd tools/umbba-cli
PS> py -m pip install -r requirements.txt
```

설치되는 것: `gallery-dl`, `requests`, `python-dotenv`, `yt-dlp`

### 3. `.env` 작성
```powershell
PS> Copy-Item .env.example .env
PS> notepad .env
```

`.env` 예시:
```
UMBBA_API_URL=https://www.umbba-radar.com
ADMIN_CLI_TOKEN=Vercel과_동일한_긴_랜덤_토큰
UMBBA_SLEEP=2.0
UMBBA_COOKIES_FILE=C:\Users\myj87\Documents\Claude\Projects\앱프로젝트\umbba-radar\tools\umbba-cli\cookies.txt
```

### 4. 인스타 로그인 쿠키 (Firefox 권장)
1. Firefox 에서 인스타 로그인 (테스트용 더미 계정 권장)
2. Firefox 확장 "cookies.txt" 설치
3. instagram.com 페이지에서 확장 클릭 → "Export" → `cookies.txt` 다운
4. `tools/umbba-cli/cookies.txt` 로 저장
5. `.env` 의 `UMBBA_COOKIES_FILE` 경로 맞춤

⚠️ `cookies.txt` 는 git 에서 제외 (`.gitignore` 자동 처리).

---

## 사용

### 큐 폴링 모드 (권장)

웹에서 `/admin/bulk-ingest` 에 URL 등록만 해두고, CLI 는 정기 실행:

```powershell
PS> py ingest.py --pull --limit 5
```

출력 예:
```
📡 큐 pull (limit=5)
   API: https://www.umbba-radar.com
   가져온 항목: 3개

[1/3] https://www.instagram.com/p/DYuPnFWFN-i/
    📥 이미지 234KB + 캡션 215자
    ✅ pending 생성 — "○○ 분유 무료 샘플 신청" (신뢰도 87%)
[2/3] https://www.instagram.com/p/DYwoJrbDj-J/
    📥 이미지 156KB + 캡션 312자
    🔁 중복 (post_id=abc12345...)
[3/3] https://www.instagram.com/reel/HIJKLMN67890/
    📥 이미지 87KB + 캡션 256자
    ✅ pending 생성 — "□□ 영상 후기" (신뢰도 71%)

✅ 완료: 2개 생성, 1개 중복, 0개 실패
   검수: https://www.umbba-radar.com/admin/queue
```

### Windows 작업 스케줄러 등록 (자동 폴링)

1. **시작 메뉴 → "작업 스케줄러" 실행**
2. 우측 패널 **"기본 작업 만들기"** 클릭
3. 이름: `엄빠레이더 CLI Polling`
4. 트리거: **매일 → 1시간마다 반복 → 무기한**
5. 동작: **프로그램 시작**
   - 프로그램: `py`
   - 인수: `ingest.py --pull --limit 5`
   - 시작 위치: `C:\Users\myj87\Documents\Claude\Projects\앱프로젝트\umbba-radar\tools\umbba-cli`
6. 마침 → 우클릭 → 속성 → **"가장 높은 권한으로 실행"** 체크 → **"사용자가 로그온하지 않아도 실행"** (선택)

매 정각마다 자동으로 큐 5개씩 처리됨. PC 가 켜져있어야 동작.

### 파일 모드 (수동·테스트용)

```powershell
PS> py ingest.py urls.txt           # 처리
PS> py ingest.py urls.txt --dry-run # 다운만 (디버깅)
```

---

## 트러블슈팅

### "큐 pull 실패: Unauthorized"
`.env` 의 `ADMIN_CLI_TOKEN` 이 Vercel env 토큰과 다름. 양쪽 같게 맞춤.

### "대기 큐 비어있음"
정상. `/admin/bulk-ingest` 에 URL 등록되어 있어야 가져갈 게 있음.

### 인스타 다운 실패 (대량)
- `UMBBA_SLEEP=5.0` 으로 조정 (`.env`)
- 쿠키 만료 가능 → Firefox 에서 인스타 재로그인 후 쿠키 재export
- 1~2시간 대기 후 재시도

### 영상 게시물 (Reels)
gallery-dl 이 영상 + 썸네일 둘 다 다운 → 우리 스크립트는 가장 큰 이미지(썸네일) 사용. 정상 동작.

### 큐 상태가 processing 인 채 멈춤
서버가 자동 정리. CLI 가 죽으면 10분 후 processing → todo 자동 복귀 → 다음 폴링에서 재처리.

---

## 정책

| 항목 | 정책 |
|---|---|
| 사용 환경 | 운영자 본인 PC. 클라우드 서버 X (IP 차단 위험) |
| 인스타 로그인 | 테스트용 더미 계정 권장. 본 계정은 정지 위험 |
| Rate limit | 기본 2초 sleep. 5개 = 약 30~60초 |
| 폴링 주기 | 1시간 (작업 스케줄러) — 인스타 의심도 ↓ |
| 결과 카드 | `status=pending, source_type=ingestion` → 검수 큐 자동 진입 |
| 실패 | status=failed + error 기록 → 웹에서 재시도 버튼 |

---

## 향후 개선

- [ ] 병렬 처리 (concurrent.futures) — 2~4배 속도
- [ ] 인스타 해시태그 자동 모니터링 (`gallery-dl --filter`)
- [ ] 처리 결과 로그 파일 (`logs/YYYY-MM-DD.log`)
- [ ] 시스템 트레이 알림 (Windows 토스트)

# umbba-cli — 인스타 게시물 일괄 등록 CLI

운영자 PC에서 실행. 인스타 게시물 URL 목록 → 자동 다운로드 + AI 분류 + 엄빠레이더 draft 생성.

본인 IP를 사용해서 Vercel 서버보다 인스타 차단 위험이 훨씬 낮음.

---

## 흐름

```
인스타 URL 리스트 (urls.txt)
        ↓
gallery-dl로 이미지 + 캡션 다운 (본인 IP)
        ↓
엄빠레이더 API에 POST
        ↓
Vercel: Storage 업로드 + Gemini Vision 분류 + draft 저장
        ↓
/admin/queue에서 검수 → 발행
```

---

## 설치 (1회만)

### 1. Python 3.10+ 확인
```bash
$ python3 --version
Python 3.10.12  # 또는 그 이상
```

없으면 https://www.python.org/downloads/ 에서 설치.

### 2. 패키지 설치
```bash
$ cd tools/umbba-cli
$ pip install -r requirements.txt
```

설치되는 것:
- `gallery-dl` — 인스타 다운로더
- `requests` — HTTP 요청
- `python-dotenv` — .env 로딩

### 3. .env 작성
```bash
$ cp .env.example .env
$ # 에디터로 .env 열고 ADMIN_CLI_TOKEN 입력
```

`.env` 예시:
```
UMBBA_API_URL=https://umbba-radar.com
ADMIN_CLI_TOKEN=어드민이_발급해서_Vercel env에_저장한_긴_랜덤_토큰
UMBBA_SLEEP=2.0
```

### 4. ADMIN_CLI_TOKEN 발급

서버 측 Vercel env에 추가해야 함 (한 번만):

1. 긴 랜덤 토큰 생성 (예: `openssl rand -hex 32` 또는 1Password 비밀번호 생성기)
2. Vercel Dashboard → Project → Settings → Environment Variables
3. 추가: `ADMIN_CLI_TOKEN` = `(생성한 토큰)` (Production·Preview·Development 모두 체크)
4. Vercel 재배포 (자동)
5. 같은 토큰을 위 `.env`에도 입력

⚠️ **이 토큰 노출되면 누구나 카드 등록 가능**. .env는 git 제외(.gitignore), 클라우드 공유 X.

---

## 사용

### URL 목록 작성

`urls.txt` 파일 만들기. 한 줄에 인스타 URL 하나. 주석은 `#`.

```
# 5월 26일 발견 모음
https://www.instagram.com/p/DYuPnFWFN-i/
https://www.instagram.com/p/DYwoJrbDj-J/
https://www.instagram.com/p/ABCDEFG12345/

# 영상 게시물 (썸네일만 다운됨)
https://www.instagram.com/reel/HIJKLMN67890/
```

### 실행

```bash
$ python ingest.py urls.txt
```

출력 예:
```
📋 4개 URL 처리 시작
   API: https://umbba-radar.com

[1/4] https://www.instagram.com/p/DYuPnFWFN-i/
    📥 이미지 234KB + 캡션 215자
    ✅ draft 생성 — "○○ 분유 무료 샘플 신청" (신뢰도 87%)
[2/4] https://www.instagram.com/p/DYwoJrbDj-J/
    📥 이미지 156KB + 캡션 312자
    ✅ draft 생성 — "△△ 체험단 모집" (신뢰도 92%)
[3/4] https://www.instagram.com/p/ABCDEFG12345/
    📥 이미지 198KB + 캡션 178자
    🔁 중복 (post_id=abc12345...)
[4/4] https://www.instagram.com/reel/HIJKLMN67890/
    📥 이미지 87KB + 캡션 256자
    ✅ draft 생성 — "□□ 영상 후기" (신뢰도 71%)

✅ 완료: 3개 생성, 1개 중복, 0개 실패
   검수: https://umbba-radar.com/admin/queue
```

### 옵션

#### `--dry-run`
다운만 하고 API 호출 안 함. 차단 위험 검증·디버깅용.

```bash
$ python ingest.py urls.txt --dry-run
```

---

## 트러블슈팅

### "gallery-dl 미설치"
```bash
$ pip install gallery-dl
$ gallery-dl --version  # 동작 확인
```

### "401 Unauthorized"
`ADMIN_CLI_TOKEN` 불일치. `.env` 토큰 = Vercel env 토큰 같은지 확인.

### 인스타 다운 실패 (rate limit)
- `UMBBA_SLEEP` 값을 늘림 (`.env`에서 2.0 → 5.0)
- 너무 많은 요청은 IP 일시 차단 위험. 1~2시간 후 재시도.

### 영상 게시물 (Reels)
gallery-dl은 영상 + 썸네일 둘 다 다운. 우리 스크립트는 가장 큰 이미지 파일 = 썸네일 사용 (영상 X). 정상 동작.

### 비공개 게시물·로그인 필요
이 CLI는 **공개 게시물만** 처리. 비공개는 차단되지만 그 자체로 문제는 아님 (그냥 fail).

로그인 쿠키 사용하면 더 안정적이지만:
- 본인 인스타 계정 사용 → 계정 정지 위험
- 권장: 공개 게시물만 자동, 비공개는 수동

---

## 정책 정리

| 항목 | 정책 |
|---|---|
| 사용 환경 | 운영자 본인 PC. 클라우드 서버에선 실행 X (IP 회전 효과 ↓) |
| 인스타 계정 로그인 | 권장 X. 공개 게시물만 처리 |
| Rate limit | 기본 2초 sleep. 100개 = 약 4~6분 (다운 + Vision 호출 포함) |
| 차단 시 대응 | UMBBA_SLEEP 증가 + 1~2시간 휴식 |
| 결과물 | 모든 카드 `status=draft, source_type=ingestion`. 큐에서 검수 후 published |

---

## 향후 개선 (운영 데이터 누적 후)

- [ ] 병렬 처리 (concurrent.futures) — 2~4배 빠르게
- [ ] 인스타 해시태그 자동 모니터링 (`gallery-dl --filter` + 정기 실행)
- [ ] 처리 결과 로그 파일 저장 (`logs/YYYY-MM-DD.log`)
- [ ] 실패한 URL 자동 재시도 (지수 backoff)
- [ ] 시스템 트레이 / Windows 알림 통합

# 인수인계서 — 2026-05-29 압축본

> **새 세션 시작 시 이 문서 + `OWNERSHIP.md` + `AGENTS.md` + `tools/umbba-cli/RULES.md` 먼저 읽으세요.**
> 5/25~5/29 4일간 인스타 모니터링·자동화·로컬 분석 모드 구축. 컨텍스트 압축본.

---

## 🚨 현재 진행 중 (즉시 사용자 액션)

### 1. A루틴 (--scan) 작업 스케줄러 등록 — 사용자 진행 중
- 매일 21:30: `py ingest.py --scan` (인스타 신규 URL 큐 저장, 비용 0)
- 시작 위치: `C:\Users\myj87\Documents\Claude\Projects\앱프로젝트\umbba-radar\tools\umbba-cli`
- 조건: "절전 모드 해제" + "예약된 시간 후에 가능한 한 빨리"

### 2. B루틴 (분류+import) Claude routine 등록 대기
- 매일 22:00 자동 실행 예정
- 내용: `--auto-export` → 분류 → `--import`
- 직전 schedule skill 호출 실패 ("Connecting trouble with remote claude.ai")
- 재시도 필요

### 3. Anthropic Console 월 한도 (백업용 안전망, 선택)
https://console.anthropic.com/settings/limits → Monthly $20
- B루틴이 Claude routine 으로 가면 비용 0, 필요 X
- 만약 `--pull` (API 모드) 도 같이 운영하면 안전망으로 권장

### 4. ③ 카드 승인 검수 (매일 운영)
- `/admin/queue` 에 자동으로 카드 쌓임 → 발행 결정
- 17개 발행 완료 (1차 라운드, 5/28)

---

## 🏗️ 시스템 개요 (Phase 2 인스타 자동화)

### 운영 흐름
```
[① 팔로잉 계정 등록]
  /admin/accounts — 102개 인스타 username 등록됨

[A루틴] py ingest.py --scan
  102계정 중 30개씩 순회 (last_scanned_at 오래된 것부터)
  gallery-dl --simulate -j 로 각 계정 /posts/ 페이지 fetch
  신규 게시물 URL + 캡션(2000자) + 메타 → ingest_queue 저장
  인스타 호출만, 비용 0

[② URL 큐 검수] /admin/bulk-ingest
  대기 기본 탭 + 3일 필터 (오래된 done/failed 자동 숨김)
  캡션 미리보기 200자 표시, hover 시 전체

[B루틴] 두 가지 선택지 (병존 가능):

  옵션 A) py ingest.py --pull --limit N  (Claude API 모드)
    todo N개 가져와 gallery-dl 이미지 다운 → Storage 업로드
    → Vercel /api/admin/bulk-ingest-with-image
    → Claude Sonnet 4.5 Vision 분류 (캡션 + 이미지 같이)
    → is_actual_event=false 또는 confidence<0.4 면 status='skipped' (카드 X)
    → 진짜 모집만 카드(pending) 생성
    카드당 약 24원

  옵션 B) py ingest.py --auto-export → Claude Code 분류 → --import
    --auto-export: 텍스트만 JSON 저장 (인스타 호출 0)
    Claude Code: RULES.md 따라 분류, results.json 생성 (구독 내, 비용 0)
    --import: skip=false 만 이미지 자동 다운 + Storage 업로드 + 카드 생성
    인스타 호출 ~20회 (전체 51회 → 60% 절감), 비용 0

[③ 카드 승인] /admin/queue
  pending 카드 검수 → 발행 / 수정 후 발행 / 반려
```

### 분류 책임 분리 (RULES.md 정책)
- **Claude (Code 또는 API)**: 자동 skip 판단 + 분류
- **사용자**: 발행 결정만 (큐 검수·노이즈 제거 X)

### skip 자동 패턴 8종 (vision-extractor + RULES.md 둘 다 반영)
1. 이벤트 기간 만료
2. 신청 방법 없음 (참여·댓글·팔로우 키워드 부재)
3. 단순 광고·자랑·후기
4. 매장 영업 안내
5. 정치·종교·논란성
6. 무관 콜라보 알림 (모집 X)
7. LIVE 방송 안내 (시청 권유)
8. 기존 구매자·사용자 대상 ("○○ 사용 모습 담아주세요" 등)

---

## 🛠️ CLI 명령 cheatsheet

위치: `C:\Users\myj87\Documents\Claude\Projects\앱프로젝트\umbba-radar\tools\umbba-cli`

```powershell
# A루틴 (인스타 fetch)
py ingest.py --scan                            # 30계정, 캡션·메타
py ingest.py --scan --max-accounts 100         # 한 번에 더 많이 (인증 직후 비추)
py ingest.py --scan --recent 5                 # 계정당 5개 게시물 (기본 3)

# B루틴 옵션 A (Claude API)
py ingest.py --pull --limit 5                  # 카드당 ~24원
py ingest.py --pull --limit 10

# B루틴 옵션 B (로컬, 비용 0)
py ingest.py --auto-export                     # 텍스트만 export
# → Claude Code 분류 → results.json
py ingest.py --import C:\path\results.json     # skip=false 만 이미지 자동 다운

# 단발 (수동 등록)
py ingest.py urls.txt                          # URL 목록 파일 처리
```

### 환경 변수 (`.env`)
```
UMBBA_API_URL=https://www.umbba-radar.com
ADMIN_CLI_TOKEN=<Vercel 동일 토큰>
UMBBA_SLEEP=10                                  # 계정 간 sleep (인스타 부담 ↓)
UMBBA_COOKIES_FILE=C:\...\cookies.txt           # Firefox export
```

### Vercel 환경변수 (Production+Preview)
- `ANTHROPIC_API_KEY` (sk-ant-api03-...)
- `VISION_PROVIDER=claude` (또는 `gemini` fallback)
- `ADMIN_PASSWORD`, `ADMIN_CLI_TOKEN`
- `SUPABASE_*`, `NAVER_*`, `VAPID_*`, `CRON_SECRET`

---

## 📊 어드민 페이지 구조 (현재 단계 명시됨)

```
네비: 카드 목록 / ① 팔로잉 계정 / ② URL 큐 / ③ 카드 승인 [N] / 새 카드 / 통계 / 회원 관리
```

- `/admin` — 카드 관리 (필터·정렬·마감탭 추가됨, FilterBar 신규)
- `/admin/accounts` — 인스타 username 등록 (102개)
- `/admin/bulk-ingest` — URL 큐 (대기/완료/중복/실패 탭, 캡션 미리보기, 로컬 모드 패널)
- `/admin/queue` — 카드 승인 (Claude 분류 후 검수)
- `/admin/users` — 회원 관리 (auth.users + children + profiles + push 통합, 삭제 가능)
- `/admin/new` — 단발 카드 생성 (스크린샷 탭 제거됨, URL 만)
- `/admin/[id]/edit` — 카드 수정 (body textarea 14줄 320px)

---

## 📋 핵심 결정·정책

### 비용 모델
- **목표**: Claude API 호출 0 (Claude Code 구독 활용)
- **현실**: A루틴 100% 비용 0, B루틴은 Claude Code routine 으로 0 (또는 --pull API 모드 카드당 24원)
- **안전망**: Anthropic Console 월 $20 한도 (--pull 모드 사용 시)

### 인스타 안전 운영
- 더미 계정 사용 (본 계정 절대 X)
- 5/28 한 번 잠겼다가 메일 인증으로 풀림 → 이후 보수적 설정
  - sleep 10초 (`.env` UMBBA_SLEEP=10)
  - max-accounts 30 (기본)
  - recent 3 (기본)
- cookies.txt 주기적 재export (1주 1회 권장)
- 작업 스케줄러 시간 약간 분산 (매일 정확히 같은 시각 X)

### RULES.md 정책 (`tools/umbba-cli/RULES.md`)
운영하며 다듬는 살아있는 룰셋. 핵심:
- title 에 brand_name 절대 X (별도 표시됨)
- brand_name 한글 우선 (BEBERO → 베베로)
- body 원문 그대로 (요약 금지) — •참여방법·이벤트 기간·발표 다 살리기
- 시기 안전 마진 (베개=신생아부터, 선크림=영아부터 등)
- search_keywords 본문 단어 중복 금지, 동의어만
- skip 패턴 8종 적극 적용 (사용자 확인 X)
- confidence 0.85 시작 → +/- 가감

### 큐 시스템 (마이그레이션 016, 017, 018)
- `ingest_queue`: url unique, status (todo/processing/done/duplicate/failed)
- `ingest_queue.caption_preview`: 2000자 저장 (UI 200자 표시)
- `instagram_accounts`: 모니터링 대상 102개 + last_scanned_at 추적
- 3일 이상 옛 항목 UI 자동 비노출 (DB 행은 유지)

### 어드민 흐름
- 큐 검수에서 사용자가 노이즈 [삭제] X → Claude 가 자동 skip
- 사용자 = ③ 카드 승인 발행 결정만
- 모든 단계 명시 (① 팔로잉 → ② URL 큐 → ③ 카드 승인)

---

## 🐛 알려진 이슈 / 주의사항

### datetime.utcnow() DeprecationWarning
해소 완료 (5/29). 현재 코드는 `datetime.now(timezone.utc)` 사용.

### gallery-dl JSON 출력 파싱
인스타 사용자 페이지 URL 끝에 `/posts/` 필수 (없으면 user 페이지에서 멈춤).
`-j` 출력은 indented JSON 한 덩어리 (줄 단위 X) — 전체 json.loads 후 배열 순회.
에러 entry `[-1, {error, message}]` 검출 → 우리 코드가 last_error 로 보고.

### 인스타 더미 계정 잠금 위험
- 일일 시간당 fetch 양 100 미만 권장
- 본인 확인 통과 후 1~2시간 자제 (의심도 가라앉기)
- 새 더미 만들 때 다른 Gmail 별칭 + 실제 SMS 번호 사용

### Claude routine schedule skill 일시 실패
"We're having trouble connecting with your remote claude.ai account" — 잠시 후 재시도.

---

## 📝 5/25~5/29 진행 작업 압축 요약

### 알림 시스템 (5/25)
- 마감 임박 D-3 푸시 (cron), 가입 이후 신규만, 본 항목 반투명
- web-push + VAPID + Service Worker

### 마감일 미정 (5/25, 마이그레이션 014)
- `deadline_unknown` boolean, 등록일+7일 자동
- 1/3/7일 옵션 (DEFAULT 7일)

### 검색 동의어 (5/26, 마이그레이션 015)
- `search_keywords` 컬럼 + pg_trgm GIN 인덱스 4개
- AI 자동 생성 (콤마 구분 1~3개)

### PWA 고도화 (5/26~5/27)
- share_target manifest (외부 공유 → /submit)
- 4 shortcuts (홈·내 레이더·체험단·제보)
- assetlinks.json (TWA 검증)

### 계정 삭제 (5/27)
- /account-deletion 페이지 + Server Action
- 본인이 회원 탈퇴 가능 (auth.admin.deleteUser)

### Phase 1 자동화 (5/27)
- URL 자동 추출 (og:image + caption)
- /admin/bulk-ingest 일괄 등록 페이지
- 인스타는 차단되어 사실상 비활성 (외부 도구 안내만)

### Phase 2 CLI 자동화 (5/28)
- tools/umbba-cli Python CLI (gallery-dl + Firefox cookies)
- /api/admin/bulk-ingest-with-image (Bearer 인증)
- 더미 인스타 계정 + Firefox 쿠키 export 셋업

### review 제거 (5/28)
- kind enum 에서 review 옵션 제거
- 자동수집 결과는 무조건 recruiting

### Claude Vision 통합 (5/28)
- `@anthropic-ai/sdk` 설치
- VISION_PROVIDER env 토글 (claude/gemini)
- system prompt 캐싱 (5분 ephemeral, 비용 18% 절감)
- 캡션도 같이 분류에 활용 (Vision API 입력)

### 인스타 모니터링 시스템 (5/28)
- 마이그레이션 017: `instagram_accounts` 테이블
- /admin/accounts 페이지 (username 일괄 등록·삭제·토글)
- CLI `--scan` 모드 (gallery-dl --simulate -j)
- /api/admin/accounts/active + /report endpoint

### 큐 미리보기 (5/28, 마이그레이션 018)
- ingest_queue 에 source_username·source_post_date·caption_preview 추가
- CLI scan 이 메타 다 fetch, 큐 UI 에 표시
- 캡션 2000자 저장 (UI 200자)

### 로컬 분석 모드 A·C (5/28)
- /api/admin/queue/export-todo + import-results
- LocalModePanel UI ([Export] [Import] 버튼)
- CLI `--auto-export [--with-images]` + `--import`
- C 모드 = 이미지 다운 + Storage 업로드 + JSON 저장
- A 모드 = 텍스트만, 이후 분류 단계에서 이미지 처리

### RULES.md 강화 라운드 1·2 (5/28~5/29)
- 라운드 1: 두 세션 결과 비교 후 룰 강화 (제목 brand X, 시기 마진, search_keywords)
- 라운드 2: skip 자동화 8종 (이벤트 만료·신청방법 없음·광고·매장·정치·콜라보·LIVE·기존 구매자)
- body 톤 변경 (요약 X, 원문 그대로 + •불릿)

### 하이브리드 자동화 (5/29)
- vision-extractor SYSTEM_PROMPT 에 RULES.md 룰 풀로 반영
- bulk-ingest-with-image 에서 is_actual_event=false 또는 confidence<0.4 → status='skipped'
- CLI --pull 가 'skipped' 응답 처리 (큐 failed 마킹)

### 영상 썸네일 다운 (5/29)
- download_post 가 이미지 없으면 메타의 display_url 직접 다운
- video-thumbnail.jpg 로 저장 → 정상 흐름 진행

### --import 가 skip=false 만 이미지 자동 다운 (5/29)
- run_import_mode 가 results.json 분석
- skip=false + thumbnail_url 없는 항목만 큐 url 매핑 fetch
- gallery-dl 이미지 다운 + Storage 업로드 + thumbnail_url 채워서 import
- 인스타 호출 60% 절감 효과

### UI 정리 (5/29)
- 큐 리스트 기본 '대기' 탭 + 최근 3일 필터
- 어드민 메뉴 ① 팔로잉 / ② URL 큐 / ③ 카드 승인 단계 명시
- /admin 필터 (시기/유형/상태) + 정렬 + 마감 탭
- 회원 관리 페이지 + 삭제 기능
- FilterBar 자녀 사용자 '전체' 버튼 버그 픽스

### 운영 검증 (5/29)
- 1차 라운드: 78개 → 17개 카드 발행 성공 (skip 32, 실패 0)
- 인스타 호출 17번 모두 정상 통과 (인증 후)
- B 모드 (이미지 포함) 풀 자동화 흐름 검증 완료

---

## 🔮 다음 세션 작업 후보

### 우선순위 높음
1. **schedule skill 재시도** — B루틴 (분류+import) Claude routine 자동 등록
2. **A루틴 작업 스케줄러 검증** — 사용자가 등록 후 동작 확인
3. **2차 라운드 운영** — 새 RULES.md 룰 (LIVE·기존 구매자·중복) 효과 검증

### 중간 우선순위
4. **카드 품질 운영 데이터 수집** — 운영 1주 후 RULES.md 추가 다듬을 부분 검토
5. **Play Store 출시 (#47~51)** — versionCode 3 빌드 + 14일 카운트
6. **MAU 트래킹** — Stats 페이지에 일/주/월 활성 사용자

### 낮은 우선순위
7. Batch API (50% 추가 절감) — 카드 100건+/일 누적 시
8. Chrome 확장 (Phase 4) — 인스타 보면서 1클릭 URL 등록
9. 새 더미 인스타 계정 백업 (현 계정 잠금 대비)

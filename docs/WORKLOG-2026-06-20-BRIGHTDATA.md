# 워크로그 — 2026-06-20 (인스타 수집 Bright Data 전환)

> 다른 대화/세션이 이어서 작업할 수 있게 정리한 핸드오프.
> 전체 구조도 **`OVERVIEW.md`**, 이전 워크로그 **`WORKLOG-2026-05-31.md`** 참고.
> ⚠️ public repo — **토큰·키 값은 여기 안 적음**(위치만). 실제 값은 `.env`/Vercel/User 환경변수에.

---

## 0. 한 줄 요약
인스타 수집을 **gallery-dl + 로그인 쿠키(→401 계정밴)** 에서 **Bright Data API** 로 전환. 우리 계정/쿠키를 아예 안 써서 밴이 구조적으로 불가능. PoC→프로덕션 검증 완료, 마감일 버그 수정 배포(`c7b1d71`), 자동화 스크립트(Win/Mac) 준비. 현재 백필 재처리 진행 중.

## 1. 문제 → 해결
- **문제**: gallery-dl이 `/api/v1/feed/user/` 를 로그인 쿠키로 긁다가 **401 계정 소프트블록**(계정 단위라 프록시·쿠키 재export로 안 풀리고 쿨다운만 회복). 계정 램프·세션 관리가 큰 운영부담.
- **해결**: **Bright Data "Instagram - Posts / discover by url"** 로 전환. BD가 자기 인프라(계정/프록시)로 긁음 → 우리 계정 무관, **밴 구조적 소멸**. 응답에 캡션 전문+이미지URL+날짜가 한 번에 와서 기존 ②스캔+④이미지다운이 1콜로 흡수.

## 2. 만든 코드 (현행 `ingest.py` 무수정 → 롤백 = 안 돌리면 끝)
- **`tools/umbba-cli/bd_client.py`** — BD API 공용 클라이언트. `trigger_discover`/`wait_ready`/`fetch_snapshot`(202 building 재시도)/`progress`/`map_record`/`first_image`/`fetch_cdn_image`.
- **`tools/umbba-cli/bd_ingest.py`** — 운영 러너. `ingest.py` 를 import만 해서 `fetch_active_usernames`/`report_account_scan`/API 상수 재사용. 풀파이프라인:
  - 활성계정(`/api/admin/accounts/active`) → BD discover(start_date=최근N일 신규필터) → CDN 이미지 fetch(쿠키X) → **기존 `/api/admin/bulk-ingest-with-image`**(AI분류+pending카드, 서버 무수정) → 검수 큐.
  - `--snapshot <id>` 모드: 재스캔/재과금 없이 기존 스냅샷 재처리(실패 복구·수동용).
  - `--dry-run`/`--accounts`/`--recent`/`--scan-days`/`--max-accounts` 지원.
- **BD 기술 메모**: dataset `gd_lk5ns7kz21pck8jpis`, 비동기 `POST /datasets/v3/trigger?type=discover_new&discover_by=url` → `/progress/{id}` 폴링 → `/snapshot/{id}?format=json`. input `{url, num_of_posts, start_date(MM-DD-YYYY), end_date, post_type}`. progress가 `records`(과금)/`errors`(dead_page=무과금) 분해 제공.
- **매핑**: `url`→url, `user_posted`→source_username, `date_posted`(ISO)→source_post_date, `description`→caption_preview(2000컷), `post_content`의 첫 Photo url→image_url(릴스는 `thumbnail` JPG).

## 3. 잡은 버그 4개
1. **마감일 연도** — 캡션의 연도 없는 "6/28"을 모델이 과거연도로 추측 → 카드가 곧바로 "마감"으로 오판(검수 때 "마감 처리"로 유효 이벤트 보관 위험). `vision-extractor.ts` `buildUserPrompt`에 **오늘(KST) 주입 + "연도 없으면 미래 해석"** 추가. **커밋 `c7b1d71`, 배포 ready 확인.**
2. **202 레이스** — 대형 스냅샷은 progress=ready 직후에도 데이터 빌드 시차로 `/snapshot`이 HTTP 202("building, try again 30s") → fetch가 죽음. `fetch_snapshot` 재시도 + `--snapshot` 재처리로 해결(실패 스윕 재과금 없이 복구).
3. **릴스 이미지** — `post_content[0].url`이 영상(.mp4)이라 카드 이미지 깨짐 → 영상이면 `thumbnail`(JPG) 사용.
4. **reshare** — BD discover는 모니터링 계정이 리셰어한 글을 원작자(`user_posted`)로 표기 → 요청계정명과 안 맞으면 버려지던 것(과금했는데 카드 X) → **전부 처리**(서버가 url로 dedup).

## 4. 비용 (실측 확정)
- **Bright Data**: 756 활성계정 2일에 **830 records**(신규만 과금, dead_page 277 무과금). 일일운영(window=주기) 기준 **~월 2.6만원**. PAYG, 월정액·약정 無.
- **⚠️ AI 분류 = Claude Sonnet 4.5 (유료!), Gemini 아님.** `vision-extractor.ts`는 `VISION_PROVIDER`로 분기하는데 **`.env.local`에 `VISION_PROVIDER=claude`** 로 설정돼 있음(과거 Gemini 키 정지로 Claude 전환). 카드=글마다 Claude 1콜 ~$0.014 → 일 415~830건이면 **월 ~$175~350(₩25~50만)** = **진짜 메인 비용, BD를 압도.** 2026-06-21 백필 830건이 Claude 크레딧 소진시킴(Anthropic "크레딧 소진" 메일).
- **현재 둘 다 다운**: Claude=크레딧 소진, **Gemini 키=정지(403 CONSUMER_SUSPENDED, 테스트 확인)** → **카드 분류 불가 상태.** 살리려면: (A) Anthropic 크레딧 충전(Claude 유지, 비쌈) 또는 (B) **새 Gemini 키**(새 구글 프로젝트) + `VISION_PROVIDER=gemini`(싸게). 추천 B.
- ~~합계 ~월 3만원대~~ **(오류 — AI 분류비 누락)**. 실제: BD ₩2.6만 + AI(Claude면 ₩25~50만 / Gemini면 푼돈). 부하: 인스타 계정 0(BD 인프라), 우리 서버 가벼움.
- **비용 핵심**: start_date는 "중복제거"가 아니라 "날짜창". **window=실행주기**(매일이면 `--scan-days 1`)면 각 글 1회만 과금 → 총비용=월 신규글수×단가, 주기와 무관.

## 5. 토폴로지 (어디서 도나)
`bd_ingest(머신)` → `BD(클라우드)` → `Vercel /bulk-ingest` → `Gemini(구글 클라우드)` → `DB`.
- 오케스트레이터 `bd_ingest`가 머신에서 도는 동안 **머신 ON 필요**(카드는 글마다 순차 호출이라, 끄면 남은 글 미처리). 만든 카드는 그때그때 저장돼 손실 X.
- **완전 무인(컴 0)** = `bd_ingest` 로직을 **Vercel cron + BD 웹훅(delivery)** 으로 이전. 단 Vercel 함수 시간제한→큐+cron 배치 필요 + Hobby 한도 초과 시 **Vercel Pro(~$20/월) 가능성** → 비용 애매해서 **현재는 보류**.

## 6. 자동화 스크립트 (준비됨)
- **Windows**(병행/대안): `bd-scan.ps1` + `register-bd-task.ps1`(태스크 `엄빠레이더-BD수집`, 매일 22:00, `--scan-days 1`, 기존 gallery-dl 태스크 안 건드림).
- **Mac**(채택): `bd-scan.sh` + `com.umbba.bdscan.plist`(launchd, 매일, `--scan-days 1`, `PYTHONUNBUFFERED=1`로 로그 실시간). 의존성 `pip3 install requests python-dotenv`(gallery-dl 불필요).

## 7. 결정 사항
- **운영 머신 = 24시간 켜두는 맥**(launchd). Vercel 웹훅은 비용 애매 → 보류.
- **팔로잉→계정목록 동기화 = 수동**(`/admin/accounts` 일괄 복붙, username 자동추출+중복스킵). **자동화 안 함**(합의, 다시 제안 X). BD에 following 목록 스크래퍼도 없음(Profiles/Posts/Reels/Comments 4개뿐).
- `num_of_posts`(`--recent`) **3 유지**(유저 "충분"). 단 2일내 4개+ 올리면 가장 오래된 1개 누락 가능 — 누락 신경쓰이면 10으로 올리면 비용 거의 안 늘고 해결.
- 책임 분담: **계정목록=유저, 수집=자동, 에러/최적화=Claude.**

## 8. 현재 상태 / 남은 작업
- ✅ 마감일 수정 배포(`c7b1d71`), BD 코드·검증 완료, 자동화 스크립트 준비.
- 🔄 **백필 재처리 진행 중**(노트북, `bd_ingest --snapshot sd_mqmfszguz5igf2qji`, ~2시간). 끊기면 같은 `--snapshot`으로 재개(중복 dedup).
- ⏳ 남은 것:
  1. 백필 완료 확인(생성/중복/skip + Gemini 한도 여부)
  2. **맥 세팅**: 파일(`bd_client.py`·`bd_ingest.py`·`ingest.py`·`bd-scan.sh`·plist) 복사 + `.env`(BRIGHTDATA_API_TOKEN 등) + launchd 등록. **실행 시각=다른 작업과 안 겹치게**(미정).
  3. **BRIGHTDATA_API_TOKEN 재발급**(채팅 노출분 폐기) 후 `.env` 교체.
  4. 병행 1~2일 확인 후 **gallery-dl 태스크 OFF**(`엄빠레이더-스캔`/`umbba-scan1`).
  5. (선택 최적화) **pre-dedup**(신규 URL만 AI → dup의 Gemini 낭비 제거), 필요 시 완전무인 웹훅.
  6. **admin 현행화** (백필 후 실행 예정, audit 완료):
     - **메인 대시보드** `PipelineDashboard.tsx`: 퍼널이 BD가 안 쓰는 `ingest_queue`(수집 큐) 기준이라 0으로 깨짐 → `계정 → 수집(pending 생성) → 발행` 으로. 경고문 "쿠키 만료(401)/B루틴 점검" → "BD 수집 작동 점검". 일별표/푸터 "큐/B루틴" 표현 정리.
     - **집계** `selectPipelineStats`(curation/service): `found`를 **큐 추가 → pending 카드(`source_type=ingestion`)** 기준으로 재정의(숫자 정상화).
     - **`/admin/bulk-ingest`**(LocalModePanel/QueueList/BulkIngestForm): 옛 수동 URL큐 도구 → "BD 자동수집이 기본, 수동/긴급 보조" 안내로 재라벨.
     - 곳곳 라벨/도움말(쿠키·gallery-dl·B루틴·큐) 일괄 현행화. 빌드→커밋·푸시.

## 9. 핵심 파일
- 러너: `tools/umbba-cli/bd_client.py`, `bd_ingest.py`
- 스케줄(Win): `bd-scan.ps1`, `register-bd-task.ps1`  /  (Mac): `bd-scan.sh`, `com.umbba.bdscan.plist`
- 마감일 수정: `src/modules/ingestion/vision-extractor.ts`(`buildUserPrompt`)
- 환경: `tools/umbba-cli/.env`(BRIGHTDATA_API_TOKEN, BRIGHTDATA_DATASET_ID, ADMIN_CLI_TOKEN, UMBBA_API_URL)
- 관련 메모리: `project_umbba_brightdata_migration`, `project_umbba_insta_session_ban`

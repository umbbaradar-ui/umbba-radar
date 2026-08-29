# WORKLOG 2026-08-29 — 2차 AI 검수(리뷰어) + 점수 기반 자동 발행

> 목표: "카드승인 → 새카드" 사이에 AI 검수담당자를 넣어 DB단 검수·분류 품질을 올리고,
> 고점수 카드는 자동 발행해 사람은 판단 필요 건만 본다. (검수품질·분류품질 = DB단 최대 과제)

## 0. 배경 — 유모차 검색 감사 (2026-08-29, 실DB)

`유모차·유아차·웨건` 매칭 99건(published 15 / expired 84) 전수 확인 결과:

| 문제 | 실측 | 대표 사례 |
|---|---|---|
| **본문(body)만 매칭돼 검색 노출** | 99건 중 41건(41%) | 치발기·블랭킷·클린파우치·적립금 카드가 유모차 검색에 뜸 |
| **search_keywords 오염** | published 15 중 2~3건 포함 다수 | 리안 "싱글콘(아이스크림) 증정"에 kw `유모차` · 미마 상품권 퀴즈에 kw `유모차,카시트` · 오이스터 사진전에 kw `유모차` — **주최사 업종을 키워드로 넣는 패턴** |
| **범용어 키워드** | 다수 | `육아용품` `신생아선물` `사은품` `외출용품` `체험단` 등 변별력 0 |
| **동일 캠페인 중복 카드** | 최소 5쌍 | "트래블러M 체험단" published 2장(8/21·8/27) · "웨건 MT3" 3장 · "베프2" 같은 날 2장 — URL만 다르면 dedup 통과 |
| **품목(item_categories) 공백** | 전 DB 83%(2,597/3,121) 미분류, **8/24 이후 수집분 100%(255/255) 공백** | gear_outing 전 DB 14장뿐. 맥 RULES.md 구버전(022 이전) 가동 의심 → **맥 git pull 필요** |
| **브랜드 표기 불일치** | 누비 / 누비유모차 / 누비NUVY | 검색·중복판정·그룹핑 모두 깨짐 |
| **비모집성 카드 유입** | 다수 | 커피·태극기·사진전 등 "브랜드가 하는 아무 이벤트" |

구조적 원인(코드 확인): ①1차 분류 confidence가 계산 후 폐기(컬럼 없음) ②skip=흔적 없는 DELETE(감사 불가)
③dedup=URL 완전일치뿐 ④stage/type 화이트리스트 부재 ⑤승인 액션의 검증=마감일 하나.

## 1. 새 파이프라인

```
03:00 맥 bd-run.sh
  1) bd_ingest.py --raw   → draft
  2) bd_classify.py       → RULES.md 분류 → pending (+ai_confidence 저장, skip은 classify_skip_log 기록 후 삭제)
  3) bd_review.py [NEW]   → REVIEW-RULES.md 2차 검수 → ai_review_score/status/note + 보정(fixes)
09:00 Vercel cron (notify-deadline)
  4) autoPublishReviewedPosts [NEW] → pending & pass & 85점+ & 썸네일 & 마감유효 → published(published_by='auto')
  5) 아침 텔레그램에 자동발행 결과 + 판단필요 분해(⚠️warn/⛔fail/◻️미검수) 포함
어드민 /admin/queue
  6) 남은 건(warn/fail/미검수)만 사람 판단 — 🤖 배지·점수·사유 표시
  7) 승인/반려/수정발행 → review_feedback 자동 기록 → 다음 검수 캘리브레이션으로 주입
```

- 검수 실행 위치 = **맥** (구독 `claude -p` 토큰이 맥에만 있음 + 24h 가동 + 3시 배치 직후 연결). 노트북=개발 전용 유지.
- 자동발행·리포트 = **Vercel** (맥이 죽으면 검수 없음 → pass 0 → 발행 0으로 안전 정지).
- 시각: 09:00 KST(기존 크론 편승 — Hobby 플랜 크론 2개 제한). 정확히 10:00 원하면 `vercel.json`의 `0 0 * * *`→`0 1 * * *` (단, 유저 마감 D-1 푸시도 10시로 같이 밀림).

## 2. 내부 수정(보정) 로직 디테일

검수자는 **삭제·발행 권한 없음, 플래그+보정만**. 이중 방어(프롬프트+서버)로 강제:

| 필드 | 보정 가능? | 서버 강제(review-results/route.ts) |
|---|---|---|
| `item_categories` | ✅ (비면 필수 채움) | `sanitizeItemCategories` 화이트리스트 12종·최대 2 |
| `search_keywords` | ✅ (오염 제거=null 허용) | 콤마 분해→trim→dedup→최대 5개·200자 |
| `stage_categories` | ✅ | `ACTIVE_STAGE_CATEGORIES` 화이트리스트, 빈 배열로 못 지움 |
| `type_tags` | ✅ | `ACTIVE_TYPE_TAGS` 화이트리스트, 빈 배열로 못 지움 |
| `brand_name` | ✅ (표기 정리만) | trim·60자, null로 못 지움 |
| `title` / `body` / `deadline` | ❌ 감점+note만 | fixes에 있어도 서버가 버림 |
| `status` | ❌ | 검수 라우트는 status 불변 — 발행은 autoPublish·사람만 |

- 점수 밴드: **pass=85+**(자동발행 후보) / warn=60~84 / fail=<60 또는 치명 결격. 서버도 점수로 재유도(모델이 판정 누락 시).
- 자동발행 추가 가드(repository.autoPublishReviewedPosts): 썸네일 없으면 보류(사람 판단), 마감 지났으면 expired 보관, `AUTO_PUBLISH_ENABLED=false`로 킬스위치, `AUTO_PUBLISH_MIN_SCORE`로 문턱 조정(50~100 클램프).
- 멱등·안전: 검수 UPDATE는 `status in (pending, published)` 조건부. 023 미적용 DB면 명확한 에러 메시지(부분 적용 방지), 기존 액션들은 재시도 폴백으로 무해.

## 3. 룰 보완(검수자 자기개선) 방안 — 3중 루프

1. **자동(무개입) — 캘리브레이션 주입**: 사람이 승인/반려/수정발행할 때마다 `review_feedback`에 (AI점수·판정·사유 vs 사람 행동) 자동 기록. `bd_review.py`가 매 실행 전 `GET /api/admin/cards/review-feedback`으로 **어긋난 사례**(reject인데 80점+ / approve인데 60점- / 수정발행)를 최대 12건 받아 프롬프트에 주입 → 다음 검수부터 즉시 반영. 코드 수정 0.
2. **주기(사람 개입) — REVIEW-RULES.md 운영 노트**: RULES.md와 같은 살아있는 문서 컨벤션. 주 1회쯤 `review-feedback` 응답의 stats/disagreements를 보고 반복 패턴을 "운영 노트" 섹션에 한 줄씩 추가(예: "○○류는 warn까지만"). Claude 세션에 "review-feedback 보고 REVIEW-RULES 운영노트 갱신해줘" 요청하면 됨.
3. **1차 룰(RULES.md) 역보완 — skip 감사**: 이제 skip은 `classify_skip_log`(사유+캡션 스니펫)에 남는다. 오탐 skip(잘못 버린 혜택)이 보이면 RULES.md skip 패턴을 완화/정밀화 — 기존엔 불가능했던 검증.

관찰 지표(텔레그램 + DB): 자동발행 비율(pass율), fail 사유 상위, disagreement 수. 자동발행 반려(=published인데 사람이 삭제)가 나오면 `published_by='auto'` 카드라는 것까지 review_feedback으로 남는다.

## 4. 변경 파일

- **DB**: `supabase/migrations/023_ai_review.sql` — posts에 ai_review_score/status/note/reviewed_at·ai_confidence·published_by + `review_feedback`·`classify_skip_log` 테이블(둘 다 RLS on·정책 없음=service_role 전용) + 부분 인덱스 2
- **서버(신규)**: `api/admin/cards/review-queue`(검수 대상+중복후보+today_kst) · `review-results`(점수/보정 저장) · `auto-publish`(GET 미리보기/POST 실행) · `review-feedback`(캘리브레이션)
- **서버(수정)**: `cards/classify`(ai_confidence 저장·skip 감사 로그·skip_reason 수용) · `curation/repository`(approvePost published_by+피드백, deletePost 피드백, autoPublishReviewedPosts, recordManualPublish) · `curation/actions`(수정발행 훅) · `cron/notify-deadline`(자동발행→워치독 순서) · `ingestion/health-watchdog`(자동발행·검수 분해 리포트)
- **어드민 UI(최소)**: `/admin/queue` 🤖 배지(통과N점/주의/부적합/미검수)+사유 한 줄 — 본격 UI/UX 개선은 후속(사용자 방침)
- **맥 CLI**: `REVIEW-RULES.md`(검수 룰셋, 유모차 감사 사례 내장) · `bd_review.py`(검수 러너, --dry-run/--enrich-published) · `bd-run.sh` 3단계 추가 · `bd_classify.py`(confidence·skip_reason 전달) · `bd_local.py`(분류 프롬프트에 skip_reason)
- **문서**: OWNERSHIP.md 정책 개정("자동 발행 영구 금지" → 점수 기반 조건부 자동 발행, 사용자 지시)

## 5. 배포 절차 (사람 작업)

1. **Supabase SQL Editor**에서 `023_ai_review.sql` 실행 (IF NOT EXISTS라 재실행 안전)
2. git push → Vercel 자동 배포 (환경변수 추가 없이 기본값으로 동작: 85점, 자동발행 ON)
3. **맥**: `git pull` — ⚠️ 이게 "품목 8/24 이후 100% 공백"의 유력 원인(RULES.md 구버전)도 같이 고침. pull 후 `bd-run-log.txt`에서 다음 새벽 "검수(2차)" 섹션 확인
4. (선택) Vercel env: `AUTO_PUBLISH_MIN_SCORE`(기본 85), `AUTO_PUBLISH_ENABLED`(false=끔)
5. (선택) 수동 점검: `GET /api/admin/cards/auto-publish` (Bearer ADMIN_CLI_TOKEN) = 발행 없이 후보 미리보기

## 6. 남은 것 / 후속 제안

- **published 백필**: 맥에서 `python3 bd_review.py --enrich-published --limit 100`을 며칠 나눠 실행 → 발행 카드 품목 공백·키워드 오염 정리(상태 변경 없음). 341건 ≈ 43배치.
- **검색에서 body 제외(또는 후순위)** 검토 — 유모차 오염 41%의 최대 원인. 키워드가 깨끗해진 뒤 FRONT 검색 쿼리에서 body를 빼는 게 정공법(제외 시 recall 손실 여부는 백필 후 판단). UI/UX 단계에서.
- 어드민 큐 정렬/필터(검수 판정별), published_by 표시 등 UI 개선 — 후속.
- expired 2,700건 백필은 불필요(아카이브 열람용).

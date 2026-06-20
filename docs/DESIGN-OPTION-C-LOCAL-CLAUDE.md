# 설계서 — 옵션 C: BD 수집 + 로컬 Claude 분류 (API 비용 0)

> 2026-06-21. 목표: **유료 Vision API(Claude/Gemini) 없이** 카드 생성.
> 분류를 **로컬 헤드리스 Claude Code(구독 정액 = 건당 과금 0)** 로 처리.
> 24시간 켜두는 맥에서 운영. 이 문서 보고 그대로 이식 가능하게 작성.

---

## 1. 왜 C인가
- A. Claude **API** = 월 ₩25~50만 (비쌈) ❌
- B. Gemini API = 싸지만 키 정지(새 키 발급 필요)
- **C. 로컬 Claude Code = 구독 정액(추가 $0)** ✅ — 이미 B루틴이 쓰던 방식. 맥 어차피 켜둠.

## 2. 핵심 제약 (코드 확인 결과)
- `POST /api/admin/queue/import-results` 는 **`queue_id` 필수**(큐 행에서 `source_url`을 읽음). → **큐(`ingest_queue`)를 반드시 거쳐야 함.** queue-less 불가.
- `import-results` 는 **Vision 호출 0** (Claude가 미리 분류한 결과만 받아 카드 INSERT). → 이게 "무료 분류" 경로의 핵심.
- 그 endpoint는 `thumbnail_url`(Storage URL)을 그대로 받음 → **이미지는 우리가 미리 업로드해서 URL만 넘기면 됨.**

## 3. 아키텍처 (단일 프로세스, 맥에서 1회 실행)
```
bd_local.py (맥, launchd 스케줄)
 ├─ 1. BD discover 스캔        → posts[{url, caption, date, image_url}]   (밴 없음·쿠키 0)
 ├─ 2. /api/admin/queue/add    → ingest_queue 에 url 적재(중복 자동 스킵)
 ├─ 3. /api/admin/queue/export-todo → queue_id 매핑 받기 {url→queue_id}
 │      (image_url 은 1번 스캔 결과로 메모리에 보관: url→image_url)
 ├─ 4. bd-input.json 작성 [{queue_id, url, caption, date}]
 ├─ 5. 헤드리스 Claude 호출  (claude -p, 구독 토큰)
 │      입력: bd-input.json + RULES.md  →  출력: bd-results.json
 │      [{queue_id, skip, title, brand_name, body, deadline, stage_categories, type_tags, topic, confidence}]
 ├─ 6. keepers(skip=false) 이미지: image_url(CDN) fetch → /api/admin/upload-image → thumbnail_url
 └─ 7. /api/admin/queue/import-results  [{queue_id, ...분류, thumbnail_url}]  → pending 카드 (Vision 0)
```
- **쿠키 0** (이미지는 BD가 준 CDN URL을 받음, gallery-dl 안 씀)
- **유료 API 0** (분류=로컬 Claude 구독, import=Vision 0)
- **서버 스키마 변경 0** (기존 endpoint 4개 재활용: queue/add, export-todo, upload-image, import-results)

## 4. 구성요소 (새것 vs 재활용)
| 구분 | 항목 |
|---|---|
| **새로 작성** | `bd_local.py`(오케스트레이터), 맥 헤드리스 Claude 래퍼(`bd-classify.sh`), launchd plist |
| **재활용** | `bd_client.py`(BD 스캔), `RULES.md`(분류 규칙), endpoints(queue/add·export-todo·upload-image·import-results), `CLAUDE_CODE_OAUTH_TOKEN` 패턴(run-b.ps1 참고) |

## 5. 헤드리스 Claude 분류 (가장 중요·새 부분)
- 인증: **`CLAUDE_CODE_OAUTH_TOKEN`**(맥에서 `claude setup-token` 1회 발급). API 키 아님 → 구독 정액.
- 호출(맥): 작업폴더에 `bd-input.json`+`RULES.md` 두고
  `claude -p "bd-input.json 항목들 RULES.md 보고 분류해서 bd-results.json 써줘. 노이즈는 skip:true."`
- run-b.ps1 의 윈도 함정(콘솔 닫힘·cmd 파이프 등)은 맥엔 대부분 없음. 단 **헤드리스 동작·토큰·출력파일 검증**은 맥에서 1회 확인 필요.
- 분류는 **캡션 텍스트 기반**(이미지 없이) — 캡션이 1차 정보원이라 충분. (이미지 분석 필요하면 추후 확장)

## 6. 비용 & 한도
- **BD 스캔**: ~월 2.6만 (그대로)
- **분류(로컬 Claude)**: **구독 정액 = 추가 $0**
- **Storage**: keepers 이미지만 업로드(노이즈는 skip → 업로드 X)
- ⚠️ **구독 사용량 한도**: 일 수백 건 분류가 Claude Code 구독의 사용량 한도에 걸릴 수 있음(돈은 아니고 횟수). → 배치 크기·야간 분산으로 조절(run-b.ps1 처럼 `maxItems` 상한). 같은 구독을 대화형으로도 쓰면 합산되니 주의.

## 7. 배포 (맥, 이식 체크리스트)
1. 파일 복사: `bd_client.py`, `bd_local.py`, `bd-classify.sh`, `RULES.md`, plist
2. `pip3 install requests python-dotenv`
3. **Claude Code 설치 + `claude setup-token`** → `CLAUDE_CODE_OAUTH_TOKEN` 환경변수
4. `.env`: `BRIGHTDATA_API_TOKEN`, `ADMIN_CLI_TOKEN`, `UMBBA_API_URL`
5. 수동 1회: `python3 bd_local.py --accounts kahi_official --scan-days 14 --dry-run`(분류까지, 카드 X) → 결과 확인
6. launchd 등록(매일, 다른 작업과 안 겹치는 시각)

## 8. 기존 "Vision 실패" junk 카드 정리
- 크레딧 소진 후 생긴 미분류 카드(title="(CLI 등록 — Vision 실패…)") **일괄 삭제** 후, 같은 스냅샷을 이 파이프라인으로 재처리.
- 삭제 수단: title 매칭 삭제(어드민 액션 or 일회성 스크립트). 구현 시 확정.

## 9. 리스크 / 오픈이슈
- **헤드리스 Claude on Mac**: 동작·토큰·출력 검증 필요(최대 미지수). 안 되면 임시로 노트북(윈도 run-b.ps1 방식)에서 분류 가능.
- **구독 사용량 한도**: 대량 분류 시. 배치 상한으로 관리.
- **분류 품질**: 텍스트 기반(현재 Claude/Gemini Vision은 이미지+캡션). 캡션 우선이라 실무상 OK 예상, 검증 필요.
- **import 200개/콜 제한**: 청크 분할(기존 ingest.py `--import`도 200 청크).

## 10. 구현 순서
1. `bd_local.py` 작성(BD스캔→queue→export-todo→input.json / results.json→upload-image→import-results)
2. `bd-classify.sh`(맥 헤드리스 claude 래퍼)
3. **노트북에서 먼저 검증**(소량, --dry-run→실제)
4. junk 삭제 스크립트
5. 맥 이식 + launchd
6. 기존 백필 스냅샷 재처리 + admin 현행화

---
> 관련: `WORKLOG-2026-06-20-BRIGHTDATA.md`(비용/provider 경위), `vision-extractor.ts`(VISION_PROVIDER), 메모리 `project_umbba_brightdata_migration`.

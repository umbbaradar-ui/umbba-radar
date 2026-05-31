# 엄빠레이더 — 카드 수집·자동화 전체 지도 (OVERVIEW)

> 카드가 어디서 어떻게 들어와 발행되는지 한눈에 보는 문서.
> 최종 갱신: 2026-05-31. (코드 기준으로 작성 — 변경 시 같이 업데이트)

---

## 1. 전체 흐름 한 장

입구는 여러 개, 출구는 하나(관리자 승인 → 발행).

```
┌──────────────────── 카드가 들어오는 입구들 ────────────────────┐

 [A] 인스타 모니터링    [B] 네이버 자동수집   [C] 관리자 수동    [D] 사용자 제보   [E] 공공API·RSS·
   로컬PC·더미계정        Vercel 매일새벽       /admin/new        /submit          체험단플랫폼
   gallery-dl           네이버검색→Gemini     URL+AI추출         URL+한줄          (예정)
   ✅구현               ✅구현(코드)          ✅구현             ✅구현(기본)      ⏳예정
      │                     │                    │                │                │
      ▼                     │                    │                │                │
  ingest_queue(todo)        │                    │                │                │
      │ B루틴(AI분류·skip)   │                    │                │                │
      └─────────────────────┴────────┬───────────┴────────────────┴────────────────┘
                                      ▼
                       posts (status = pending)   ← 모든 입구가 여기로
                                      │
                                      ▼
                       관리자 검수  /admin/queue    ⛔ 자동발행 절대 금지
                                      │ 승인
                                      ▼
                       posts (published) ──► 📱 사용자 홈 피드
                                      │ 마감 지나면 자동
                                      ▼
                       posts (expired)
```

**원칙 1줄:** 어떤 경로로 들어오든 무조건 `pending` → 사람이 승인해야 발행. 자동발행 영구 금지.

---

## 2. 자동화 루틴 3종 (현재 가동)

### 🟦 A루틴 — 인스타 스캔  (로컬 PC · 밤새 4회 분산 · Windows 작업 스케줄러)
```
scan.bat → py ingest.py --scan --max-accounts 50
  ├ 트리거 4회: 21:30 · 23:00 · 00:30 · 02:00 (밤새 분산, 절전돼도 깨워서 실행)
  ├ 회차당 50계정만(~8분, ~100읽기). last_scanned_at 순환으로 202개 전부 각 1번 커버
  ├ UMBBA_SLEEP=10초 간격(봇 의심 완화) → 단일 burst·시간당 부하 둘 다 낮춤
  ├ gallery-dl --simulate : 이미지 안 받고 URL·캡션만
  └ 새 게시물 URL → ingest_queue(todo)
  💰 비용 0 · Claude 안 씀 · 인스타엔 "구경만"
  ⚠️ 인스타 cookies.txt 만료되면 401로 수집 0 (주 1회 갱신 필요)
```

### 🟩 B루틴 — 분류 + 카드생성  (로컬 PC · 매일 03:00 · 숨김 PowerShell)
```
작업 스케줄러 → powershell -WindowStyle Hidden -File run-b.ps1  (💰비용 0, claude 구독)
  PowerShell이 오케스트레이션, claude는 "분류"만 (셸 명령·cd 없음 → 멈춤/콘솔 문제 회피)
  1) PS: py ingest.py --auto-export → exports/<ts>/todo-enriched.json (인스타 X)
  2) claude: 25건씩 배치로 RULES.md 기준 분류 → results.json (ASCII 임시폴더, 파일 읽기/쓰기만)
       └ skip=true 8~9패턴 자동제거(기간만료·신청법없음·단순광고·LIVE·기존구매자…)
  3) PS: py ingest.py --import results.json
       └ skip=false만 이미지 다운로드(gallery-dl+쿠키)→Storage → posts(pending)
  4) 로그 → b-log.txt
  인증: User 환경변수 CLAUDE_CODE_OAUTH_TOKEN (1년 유효)
  실행 조건: PC 켜짐 + 로그인 + (노트북) 전원 연결
  ※ 창 절대 닫지 말 것(숨김 처리됨) — 닫으면 claude가 CTRL_CLOSE로 죽음
```

### 🟨 네이버 블로그 자동수집  (Vercel 클라우드 · 매일 06:00 KST)  ⏸️ 현재 보류(INGESTION_ENABLED=OFF, Gemini 키 정지)
```
vercel.json cron "0 21 * * *" (UTC) = 한국시간 06:00
  → GET /api/cron/ingest  (인증: CRON_SECRET, Vercel이 자동 호출)
  → runIngestion():
      ├ 키워드 10개 × 네이버 블로그 검색(키워드당 3건 ≈ 30건)
      ├ 중복 제거 → Gemini Flash 텍스트 정규화(5건 배치, 4.5초 간격)
      ├ 신뢰도 0.6↑ & "진짜 이벤트"만 → posts(pending)
      └ 덤: 마감 지난 published 카드 → expired 자동 정리
  ※ 운영 페이지 없음. 키워드는 코드(src/modules/ingestion/keywords.ts)에 하드코딩.
  ※ 실제 작동은 Vercel 환경변수(NAVER_CLIENT_ID/SECRET, GEMINI_API_KEY, CRON_SECRET) 등록 필요.
```

추가 cron: `/api/cron/notify-deadline` (`0 0 * * *` = 09:00 KST) — 마감 임박 알림용(푸시 인프라와 연동, 부분 구현/확인 필요).

> 📌 A·B루틴 = 당신 PC(로컬). 네이버 수집 = Vercel(클라우드). 셋은 독립적으로 같은 `pending` 큐로 결과를 보냄.

---

## 3. 상태 2단계 (헷갈림 방지)

| 층 | 테이블 | 상태값 | 의미 |
|---|---|---|---|
| 수집 큐(인스타 전용) | `ingest_queue` | todo → processing → done/duplicate/failed | A루틴 수집, B루틴 처리 |
| 카드(최종) | `posts` | draft → pending → published → expired | 모든 입구의 최종 결과물 |

```
[A루틴] URL → ingest_queue(todo) ─[B루틴 분류·생성]→ posts(pending)
  ─[관리자 승인]→ published ─[마감]→ expired
```

---

## 4. 구현됨 ✅ vs 예정 ⏳

### 카드 수집 경로
| 경로 | 상태 | 운영 위치 / 비고 |
|---|---|---|
| 관리자 수동 입력(+AI 추출) | ✅ | `/admin/new` — URL→이미지 AI분석(Claude/Gemini Vision) |
| 네이버 블로그 자동수집 | ⏸️ 보류 | Gemini API 키 정지(project 991772519706)로 매일 0건 생산 → `INGESTION_ENABLED` 게이트로 OFF. 인스타 위주 전환(2026-05-31). 부활: 유효한 GEMINI_API_KEY + INGESTION_ENABLED=true |
| 인스타 모니터링(A·B루틴) | ✅ | 로컬 더미계정·gallery-dl · 민감/주의 영역 |
| 사용자 제보 `/submit` | ✅기본 ⏳본격 | URL+한줄 · 인스타/카톡 "공유→엄빠레이더" 연동 |
| 공공데이터포털(정부지원) | ⏳ | Phase 2 |
| 브랜드 공식 RSS 화이트리스트 | ⏳ | Phase 2 (신뢰 브랜드 ~30곳) |
| 체험단 플랫폼(레뷰·미블) sitemap | ⏳ | Phase 2 |

### 기능 로드맵
| 기능 | 상태 | 트리거/비고 |
|---|---|---|
| PWA 설치·공유타깃·바로가기 | ✅ | 5/26~27 완료 |
| 마감일 미정 자동처리 / 검색 동의어 | ✅ | 마이그레이션 014·015 |
| 회원 탈퇴 페이지 | ✅ | `/account-deletion` |
| 🔔 푸시 알림(D-3 임박·신규) | ⏳ | Web Push만(이메일·SMS 영구 X) · MAU 100+ 후 |
| 💰 광고·수익화 | ⏳ | Phase 3 · MAU 1,000+ · 사업자등록 후 |
| 🎁 토스 미니앱 | ⏳ | 별도 Vite 레포 · Supabase 공유 |
| 🔍 검색(FTS) | ⏳ | MAU 500+ |
| 💬 커뮤니티(댓글·후기) | ⏳ | Phase 3 |
| ⚙️ Batch API(50%↓) / Chrome 확장 | ⏳ | 카드 100건/일↑ / Phase 4 |
| 📱 Play Store 출시 | ⏳ | 폐쇄테스트 대기 |

---

## 5. 절대 규칙 (정책)
- ⛔ 자동 발행 금지 — 모든 카드는 사람이 승인해야 발행
- ⛔ 인스타·틱톡 광범위 자동 크롤링 영구 금지 (A루틴은 더미계정 제한 모니터링만)
- ⛔ 이메일·SMS 알림 영구 미사용 (Web Push만)
- ⛔ 앱 내 신청 처리 X — 외부로 보내는 순수 큐레이션 미디어
- ⛔ 광고: 한 화면 2개 이하 · 의료·금융·사행성 거부

---

## 6. 운영 주의점
1. **인스타 쿠키 주기 갱신**: `tools/umbba-cli/cookies.txt` 만료 시 A루틴 수집 0(401). Firefox에서 더미계정 로그인 후 재export (주 1회 권장).
2. **야간 운영 조건**: A루틴 21:30~02:00(4회), B루틴 03:00 → **PC를 밤새 켜두고 로그인 상태 유지**(노트북은 전원 연결). 절전은 깨워서 실행(WakeToRun)되나, 완전 종료/로그오프면 그날 건너뜀(다음날 자동 이어감). B는 야간 상한 50건(이미지 다운로드 burst 제한).
3. **네이버 수집 확인법**: 작동 중이면 매일 새벽 `/admin/queue`에 source=ingestion 카드가 쌓임. 안 쌓이면 Vercel 환경변수/키워드 점검.

---

## 7. 관련 파일 빠른 참조
| 무엇 | 파일 |
|---|---|
| 인스타 루틴(로컬) | `tools/umbba-cli/` — `ingest.py`, `scan.bat`, `run-b.ps1`, `RULES.md` |
| 네이버 수집 키워드 | `src/modules/ingestion/keywords.ts` |
| 네이버 검색 클라이언트 | `src/modules/ingestion/sources/naver-search.ts` |
| 수집 오케스트레이션 | `src/modules/ingestion/service.ts` |
| cron 엔드포인트·스케줄 | `src/app/api/cron/ingest/route.ts`, `vercel.json` |
| 관리자 검수/승인 | `src/app/admin/(private)/queue`, `src/modules/curation/` |
| 카드 상태 스키마 | `supabase/migrations/001_*`, `016_ingest_queue.sql` |

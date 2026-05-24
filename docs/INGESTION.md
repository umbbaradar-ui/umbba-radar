# Ingestion 부서 — 자동 수집 운영 가이드

> 매일 자동 수집 → AI 정규화 → 본인 1클릭 승인. 이 흐름의 운영 매뉴얼.

---

## 흐름

```
매일 06:00 KST (=21:00 UTC) Vercel Cron 트리거
       ↓
/api/cron/ingest (Bearer CRON_SECRET 검증)
       ↓
src/modules/ingestion/service.ts → runIngestion()
       ↓
키워드 10개 × 네이버 블로그 검색 (각 20건 = 최대 200건/일)
       ↓
중복 체크 (source_url 이미 있으면 skip)
       ↓
Gemini Flash로 정규화 (광고·만료·무관 필터링)
       ↓
신뢰도 < 0.6 거름
       ↓
posts INSERT (status=pending, source_type=ingestion)
       ↓
본인 /admin/queue 에서 5분 훑고 ✓ 발행 / ✗ 반려
```

---

## 환경변수 필요

`.env.local` (로컬) + Vercel Settings → Environment Variables (배포본) 양쪽에 추가:

| Key | 발급처 | 비용 |
|-----|--------|------|
| `NAVER_CLIENT_ID` | https://developers.naver.com/apps | 무료 (일 25,000건) |
| `NAVER_CLIENT_SECRET` | 동일 | 무료 |
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | 무료 (일 1,500건) |
| `CRON_SECRET` | 본인이 임의 생성 (32자 이상 랜덤) | — |

`CRON_SECRET` 생성 예시 (PowerShell):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | % {[char]$_})
```

---

## 키워드 관리

`src/modules/ingestion/keywords.ts` 편집:

```ts
export const NAVER_KEYWORDS: string[] = [
  "출산 체험단",
  // ... 추가·제외
];
```

수정 후 git push → 다음 cron부터 적용. 한 번에 5~15개 권장 (너무 많으면 노이즈·비용 증가).

### 키워드 튜닝 가이드
- **너무 일반적인 단어** ("육아") → 검색 결과 노이즈 너무 큼. 피할 것
- **너무 구체적인 단어** ("월령별 임산부 무료 영양제 체험단 모집") → 결과 거의 없음
- **적정**: "출산 체험단", "기저귀 체험단" — 카테고리 + 행동 키워드 조합

---

## 수동 트리거

cron 기다리지 않고 즉시 실행하려면:

### PowerShell
```powershell
curl.exe -X GET "https://umbba-radar.vercel.app/api/cron/ingest" -H "Authorization: Bearer $env:CRON_SECRET"
```

### Bash / Git Bash
```bash
curl -X GET https://umbba-radar.vercel.app/api/cron/ingest \
  -H "Authorization: Bearer $CRON_SECRET"
```

응답 예시:
```json
{
  "ok": true,
  "stats": {
    "fetched": 178,
    "duplicates": 12,
    "normalized": 95,
    "filtered": 67,
    "inserted": 95,
    "errors": 4,
    "durationMs": 124000
  }
}
```

---

## 결과 모니터링

### 직후
1. `/admin/queue` → 채널 필터 "자동수집만" 클릭 → 새로 들어온 카드들 확인
2. AI 정규화 품질 평가: 제목·body·카테고리가 합리적인가?

### 일주일 후
- `inserted` vs `filtered` 비율 → AI 필터 정확도 가늠
- 본인 ✓/✗ 비율 → AI vs 본인 판단 차이
- 운영 시간 (큐 처리 시간) 측정

### 한 달 후
- 키워드별 효율: 어떤 키워드가 좋은 카드를 많이 가져오나
- Gemini API 사용량 확인 (Google AI Studio 대시보드)

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 401 Unauthorized | CRON_SECRET 불일치 | Vercel env 확인, 양쪽 동일한 값인지 |
| 0건 수집 | 네이버 키 오류 또는 키워드 결과 없음 | NAVER_CLIENT_ID/SECRET 확인 |
| `normalized=0, filtered=많음` | AI가 모두 거름 | 키워드 너무 일반적, MIN_CONFIDENCE 낮추기 검토 |
| 중복 너무 많음 | 같은 글이 여러 키워드에 잡힘 | 정상. 첫 키워드 처리 후 자동 skip |
| Gemini 429 (rate limit) | 무료 한도 초과 | 키워드 줄이거나 다음 날 다시 시도 |
| Vercel Cron 안 돌아감 | vercel.json 누락 또는 무료 한도 | `vercel.json` 푸시됐는지, Hobby는 일 1회만 가능 |

---

## 비용 정리

| 항목 | 한도 | 우리 사용량 (예상) | 결과 |
|------|------|-------------------|------|
| 네이버 검색 API | 25,000/일 | 200~300/일 | 무료 (영원) |
| Gemini Flash | 1,500/일 | 30~80/일 | 무료 (영원) |
| Vercel Cron | Hobby: 일 1회·프로젝트당 2개 | 1개 사용 | 무료 |
| Supabase Storage·DB | 무료 티어 충분 | — | 무료 |

→ **자동 수집 운영비 0원.**

---

## 확장 계획

| 단계 | 추가 소스 |
|------|----------|
| Phase 2-A (지금) | 네이버 검색 |
| Phase 2-B | 공공데이터포털 (정부지원) |
| Phase 2-C | 브랜드 공식 RSS 화이트리스트 (~30곳) |
| Phase 2-D | 체험단 플랫폼 sitemap (레뷰·미블) |
| Phase 3 | 사용자 제보 (이미 /submit 로 가동 중) |

모두 같은 `runIngestion()` 안에 sources 배열만 늘리면 됨. 결과는 동일한 pending 큐로 흘러들어옴.

---

## 변경 시 체크리스트

- [ ] 키워드 변경: `keywords.ts` 편집 → push
- [ ] 신뢰도 임계값 변경: `MIN_CONFIDENCE` 값 수정
- [ ] AI 모델 변경: `normalizer.ts` 의 `GEMINI_MODEL` 변경 (예: `gemini-2.5-flash`)
- [ ] cron 시간 변경: `vercel.json` 의 schedule 수정 (cron expression)
- [ ] 새 source 추가: `sources/` 폴더에 파일 추가 + `service.ts` 에서 호출

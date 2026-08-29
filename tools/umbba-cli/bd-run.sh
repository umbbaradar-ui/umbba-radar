#!/usr/bin/env bash
# bd-run.sh — 옵션 C 하루 1회 무인 러너 (macOS/Linux launchd).
#   1) 수집: bd_ingest.py --raw  → BD 스캔 → draft(미분류) 카드 (유료 Vision API 0, 쿠키 0)
#   2) 분류: bd_classify.py       → draft → 로컬 헤드리스 Claude(구독) → pending 확정 / 노이즈 삭제
#   3) 검수: bd_review.py         → pending → 2차 검수(REVIEW-RULES.md) → 점수/판정/보정 기록
#      (pass 고점수는 매일 09:00 KST 서버 cron 이 자동 발행 — warn/fail/미검수만 사람 검수)
# 요구: python3, claude(Claude Code), .env 에:
#   BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN, UMBBA_API_URL, CLAUDE_CODE_OAUTH_TOKEN(claude setup-token)
# 사용: ./bd-run.sh [scan_days] [max_accounts] [classify_limit] [batch] [review_limit] [review_batch]
#       (기본 1 / 800 / 320 / 3 / 200 / 8)
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PY="${UMBBA_PYTHON:-python3}"
LOG="$DIR/bd-run-log.txt"
# 헤드리스 claude 인증 토큰을 .env 에서 읽어 export (claude 서브프로세스가 사용 — python-dotenv로는 안 됨)
TOK=$(grep '^CLAUDE_CODE_OAUTH_TOKEN=' .env 2>/dev/null | cut -d= -f2-)
[ -n "$TOK" ] && export CLAUDE_CODE_OAUTH_TOKEN="$TOK"
export PYTHONUTF8=1 PYTHONUNBUFFERED=1

echo "===== $(date '+%Y-%m-%d %H:%M:%S') 수집(--raw) =====" >> "$LOG"
ING=$("$PY" bd_ingest.py --raw --scan-days "${1:-1}" --max-accounts "${2:-800}" 2>&1)
echo "$ING" >> "$LOG"
# 폴링 타임아웃으로 클라가 0건 리턴했어도 스냅샷은 서버에서 완성되는 경우가 있음(재과금 없음).
# 로그의 "--snapshot sd_..." 복구 힌트를 잡아 자동 재처리. building이면 fetch_snapshot이 알아서 대기.
for SNAP in $(echo "$ING" | grep -oE '\-\-snapshot sd_[a-z0-9]+' | awk '{print $2}' | sort -u); do
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') 타임아웃 자동복구 → --snapshot $SNAP (재과금 0) =====" >> "$LOG"
  "$PY" bd_ingest.py --snapshot "$SNAP" --raw >> "$LOG" 2>&1
done
# 분류: 로컬 헤드리스 Claude(구독=무과금)라 재수집 없이 draft 0 될 때까지 여러 패스 순차 반복.
# 하루 수집량이 --limit(1패스 상한)보다 많아도 남김없이 소화. 겹침 없음(순차) + 재과금 없음(수집 X).
# claude 기본. batch 3(타임아웃↓) + 막히면 기다렸다 천천히 재시도(다른 새벽 작업과 양보).
for pass in 1 2 3 4 5; do
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') 분류 pass $pass =====" >> "$LOG"
  OUT=$("$PY" bd_classify.py --limit "${3:-320}" --batch "${4:-3}" --retries 3 --retry-wait 180 2>&1)
  echo "$OUT" >> "$LOG"
  echo "$OUT" | grep -q "할 일 없음" && { echo "  draft 0 — 분류 종료(pass $pass)" >> "$LOG"; break; }
done
# 검수(2차): 분류가 만든 pending 을 REVIEW-RULES.md 기준으로 재검증 — 점수/판정/택소노미 보정 기록.
# pass 고점수(기본 85+)는 09:00 KST 서버 cron 이 자동 발행. 분류처럼 막히면 기다렸다 재시도.
echo "===== $(date '+%Y-%m-%d %H:%M:%S') 검수(2차) =====" >> "$LOG"
"$PY" bd_review.py --limit "${5:-200}" --batch "${6:-8}" --retries 3 --retry-wait 180 >> "$LOG" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] bd-run done" >> "$LOG"

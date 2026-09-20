#!/usr/bin/env bash
# bd-queue.sh — 수동 URL 큐(/admin/bulk-ingest) 1시간 러너 (macOS launchd: com.umbba.bdqueue).
#   1) bd_urls.py --from-queue  → 큐 todo URL 을 BD 로 직접 수집(그 건수만 과금) → draft 카드 → 큐 done/failed
#   2) bd_classify.py --ids …   → 그 회차 draft 만 로컬 헤드리스 Claude(구독) 분류 → pending / 노이즈 삭제
#   3) bd_review.py             → 2차 검수 (pass 85+ 는 09:00 KST 서버 cron 이 자동 발행, 나머지 /admin/queue)
# 큐가 비면 API 1회 조회 후 즉시 종료 (BD·claude 호출 0). 새벽 bd-run.sh 가 도는 중이면 이번 회차 건너뜀
# (그쪽 bd_classify 가 draft 를 어차피 전부 집어가므로 손실 없음).
# 요구: bd-run.sh 와 동일 (.env 의 BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN, UMBBA_API_URL, CLAUDE_CODE_OAUTH_TOKEN).
# 사용: ./bd-queue.sh [limit]   (기본 40 = 한 회차 BD 과금 상한)
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PY="${UMBBA_PYTHON:-python3}"
LOG="$DIR/bd-queue-log.txt"
TOK=$(grep '^CLAUDE_CODE_OAUTH_TOKEN=' .env 2>/dev/null | cut -d= -f2-)
[ -n "$TOK" ] && export CLAUDE_CODE_OAUTH_TOKEN="$TOK"
export PYTHONUTF8=1 PYTHONUNBUFFERED=1
now() { date '+%Y-%m-%d %H:%M:%S'; }

# 새벽 루틴과 겹치면 양보
if pgrep -f "bd-run.sh|bd-local.sh|bd_ingest.py|bd_classify.py|bd_review.py" >/dev/null 2>&1; then
  echo "[$(now)] 새벽 루틴(bd-run) 실행 중 — 이번 회차 건너뜀" >> "$LOG"; exit 0
fi
# 자기 자신 중복 방지 (BD 대기가 길어져 다음 정각과 겹칠 때). 3시간 넘은 잠금은 죽은 잔재로 보고 제거.
LOCK="$DIR/.bd-queue.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null)" ]; then
    rmdir "$LOCK" 2>/dev/null; mkdir "$LOCK" 2>/dev/null || exit 0
  else
    echo "[$(now)] 이전 회차 진행 중(lock) — 건너뜀" >> "$LOG"; exit 0
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

OUT=$("$PY" bd_urls.py --from-queue --limit "${1:-40}" 2>&1); RC=$?
if echo "$OUT" | grep -q "^QUEUE_EMPTY"; then
  echo "[$(now)] 큐 비어있음" >> "$LOG"; exit 0
fi

echo "===== $(now) 수동 큐 수집 (rc=$RC) =====" >> "$LOG"
echo "$OUT" >> "$LOG"
IDS=$(echo "$OUT" | grep -oE '^CREATED_IDS=.*' | tail -1 | cut -d= -f2-)
if [ -z "$IDS" ]; then
  echo "  생성 draft 0 — 분류 생략" >> "$LOG"; exit 0
fi

N=$(echo "$IDS" | tr ',' '\n' | grep -c .)
echo "===== $(now) 분류 (이번 회차 draft ${N}건) =====" >> "$LOG"
"$PY" bd_classify.py --ids "$IDS" --batch 3 --retries 3 --retry-wait 180 >> "$LOG" 2>&1

echo "===== $(now) 검수(2차) =====" >> "$LOG"
"$PY" bd_review.py --limit 30 --batch 8 --retries 2 --retry-wait 180 >> "$LOG" 2>&1
echo "[$(now)] bd-queue done" >> "$LOG"

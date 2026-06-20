#!/usr/bin/env bash
# bd-scan.sh - Bright Data ingest runner for macOS/Linux (launchd/cron).
# bd_ingest.py 실행: 활성계정 -> BD discover(start_date 신규필터) -> CDN이미지 -> bulk-ingest(AI+pending카드).
# 쿠키/401 없음. 같은 폴더에 .env 필요: BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN, UMBBA_API_URL.
#
# 사용:  ./bd-scan.sh [scan_days] [max_accounts]   (기본 1일, 800계정)
# launchd/cron 에서 이 스크립트를 호출하면 됨.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PY="${UMBBA_PYTHON:-python3}"
SCAN_DAYS="${1:-1}"
MAX_ACCOUNTS="${2:-800}"
LOG="$DIR/bd-ingest-log.txt"

echo "===== $(date '+%Y-%m-%d %H:%M:%S') bd-scan start (max=$MAX_ACCOUNTS days=$SCAN_DAYS) =====" >> "$LOG"
# PYTHONUNBUFFERED=1 -> 로그 실시간 기록(버퍼링 방지)
PYTHONUTF8=1 PYTHONUNBUFFERED=1 "$PY" bd_ingest.py --max-accounts "$MAX_ACCOUNTS" --scan-days "$SCAN_DAYS" >> "$LOG" 2>&1
code=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S')] bd-scan done (exit $code)" >> "$LOG"
exit $code

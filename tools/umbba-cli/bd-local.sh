#!/usr/bin/env bash
# bd-local.sh - 옵션 C 러너 for macOS/Linux launchd (BD 수집 + 로컬 Claude 분류, 유료 API 0).
# 요구: python3, claude(Claude Code)+CLAUDE_CODE_OAUTH_TOKEN(`claude setup-token`),
#       .env(BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN, UMBBA_API_URL), RULES.md.
# 사용: ./bd-local.sh [scan_days] [max_accounts] [max_items]   (기본 1 / 800 / 75)
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PY="${UMBBA_PYTHON:-python3}"
SCAN_DAYS="${1:-1}"
MAX_ACCOUNTS="${2:-800}"
MAX_ITEMS="${3:-75}"   # 구독 사용량 한도 관리 (run-b.ps1과 동일 기본 75/회)
LOG="$DIR/bd-local-log.txt"

echo "===== $(date '+%Y-%m-%d %H:%M:%S') bd-local start (max=$MAX_ACCOUNTS days=$SCAN_DAYS items=$MAX_ITEMS) =====" >> "$LOG"
PYTHONUTF8=1 PYTHONUNBUFFERED=1 "$PY" bd_local.py \
  --max-accounts "$MAX_ACCOUNTS" --scan-days "$SCAN_DAYS" --max-items "$MAX_ITEMS" >> "$LOG" 2>&1
code=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S')] bd-local done (exit $code)" >> "$LOG"
exit $code

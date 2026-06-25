#!/usr/bin/env bash
# bd-run.sh — 옵션 C 하루 1회 무인 러너 (macOS/Linux launchd).
#   1) 수집: bd_ingest.py --raw  → BD 스캔 → draft(미분류) 카드 (유료 Vision API 0, 쿠키 0)
#   2) 분류: bd_classify.py       → draft → 로컬 헤드리스 Claude(구독) → pending 확정 / 노이즈 삭제
# 요구: python3, claude(Claude Code), .env 에:
#   BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN, UMBBA_API_URL, CLAUDE_CODE_OAUTH_TOKEN(claude setup-token)
# 사용: ./bd-run.sh [scan_days] [max_accounts] [classify_limit] [batch]   (기본 1 / 800 / 320 / 6)
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
"$PY" bd_ingest.py --raw --scan-days "${1:-1}" --max-accounts "${2:-800}" >> "$LOG" 2>&1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') 분류 =====" >> "$LOG"
"$PY" bd_classify.py --limit "${3:-320}" --batch "${4:-6}" >> "$LOG" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] bd-run done" >> "$LOG"

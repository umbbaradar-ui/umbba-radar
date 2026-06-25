#!/usr/bin/env bash
# 백로그 자동 스윕: draft 가 0이 될 때까지 claude 백엔드로 반복 분류.
# 이 대화 세션과 무관한 독립 프로세스(nohup)로 실행.
set -u
cd /Users/eunjae/umbba-radar/tools/umbba-cli || exit 1

TOK=$(grep '^CLAUDE_CODE_OAUTH_TOKEN=' .env 2>/dev/null | cut -d= -f2-)
[ -n "$TOK" ] && export CLAUDE_CODE_OAUTH_TOKEN="$TOK"
export PYTHONUTF8=1 PYTHONUNBUFFERED=1 UMBBA_CLASSIFIER=claude

API=$(grep '^UMBBA_API_URL=' .env 2>/dev/null | cut -d= -f2-); API=${API:-https://umbba-radar.com}
ATOK=$(grep '^ADMIN_CLI_TOKEN=' .env 2>/dev/null | cut -d= -f2-)

for pass in $(seq 1 12); do
  N=$(curl -s "$API/api/admin/cards/drafts?limit=1" -H "Authorization: Bearer $ATOK" \
      | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("items",[])))' 2>/dev/null)
  echo "=== PASS $pass — 남은 draft 확인: ${N:-?} ($(date '+%H:%M:%S')) ==="
  [ "$N" = "0" ] && { echo "✅ 초안 0 — 백로그 완료"; break; }
  python3 bd_classify.py --limit 500 --batch 3
done
echo "=== 백로그 스윕 종료 ($(date '+%H:%M:%S')) ==="

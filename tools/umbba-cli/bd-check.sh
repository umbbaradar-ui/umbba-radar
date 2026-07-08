#!/usr/bin/env bash
# bd-check.sh — BD 복구 감지 러너(launchd 1시간 간격). bd_recover_check.py 래퍼.
# 복구 감지 시 텔레그램 1회 알림 + 자기 launchd 잡 언로드(자동 종료).
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
PY="${UMBBA_PYTHON:-python3}"
export PYTHONUTF8=1 PYTHONUNBUFFERED=1
"$PY" bd_recover_check.py

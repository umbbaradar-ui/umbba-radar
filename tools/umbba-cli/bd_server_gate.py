#!/usr/bin/env python3
"""bd_server_gate.py — bd-run.sh 수집 단계 앞 관문 (R-20261105-3 3단계).

서버(Vercel)가 새벽 수집을 했는지 보고 맥이 무엇을 할지 정한다. BD 이중 과금을 막는 것이 목적.
  stdout 1줄: "collect" | "skip <sid>" | "resume <sid>" | "fallback <sid>"
  stdout 2줄: "sidecar <sid> <sid> ..."  (이미지 힌트·계정 원장을 채울 스냅샷 — 재조회 무과금)

- 서버 수집이 꺼져 있거나(env 없음) status API가 안 되면 collect = 지금까지와 같다.
- 켜져 있으면 04:30까지 기다린다(서버 수집 뒤). 맥 launchd 시각 03:00은 그대로 둔다.
- 서버가 trigger한 스냅샷이 있으면 맥은 trigger하지 않는다.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = (os.getenv("UMBBA_API_URL") or "").rstrip("/")
API_TOKEN = (os.getenv("ADMIN_CLI_TOKEN") or "").strip()
WAIT_UNTIL = dt.time(4, 30)
LEASE_WAIT_MAX = 6 * 60
LEASE_POLL = 30


def decide(st: dict | None) -> tuple[str, str | None]:
    """status 응답 → (행동, 스냅샷). 네트워크 없는 판정."""
    if not st or not st.get("ok") or not st.get("enabled"):
        return "collect", None
    run = st.get("run")
    if not run:
        return "collect", None
    stage, sid = run.get("stage"), run.get("snapshot_id")
    if not sid:
        return "collect", None             # trigger 실패 — BD 과금 없었음
    if stage == "done":
        return "skip", sid
    if stage in ("starved", "failed"):
        return "fallback", sid             # BD 응답 이상 — 예비 수집기로(BD 재호출 금지)
    return "resume", sid                   # 미완료·이미지 실패 많음 — 같은 스냅샷 재처리(재과금 0)


def get_status(tries: int = 3) -> dict | None:
    if not API_URL or not API_TOKEN:
        return None
    for i in range(tries):
        try:
            r = requests.get(f"{API_URL}/api/bd/status",
                             headers={"Authorization": f"Bearer {API_TOKEN}"}, timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (401, 404):
                return None
        except (requests.RequestException, ValueError):
            pass
        if i < tries - 1:
            time.sleep(10)
    return None


def takeover() -> None:
    try:
        requests.post(f"{API_URL}/api/bd/status", headers={"Authorization": f"Bearer {API_TOKEN}"},
                      json={"action": "takeover"}, timeout=60)
    except requests.RequestException as e:
        print(f"takeover 실패: {e}", file=sys.stderr)


def main() -> int:
    no_wait = "--no-wait" in sys.argv
    dry = "--dry" in sys.argv
    st = get_status()
    if st and st.get("enabled") and not no_wait:
        target = dt.datetime.combine(dt.date.today(), WAIT_UNTIL)
        delay = (target - dt.datetime.now()).total_seconds()
        if delay > 0:
            print(f"서버 수집 대기 {int(delay)}s (04:30까지)", file=sys.stderr)
            time.sleep(delay)
            st = get_status()
    action, sid = decide(st)
    if action in ("resume", "fallback") and not dry:
        waited = 0
        while (st or {}).get("run", {}).get("lease_active") and waited < LEASE_WAIT_MAX:
            time.sleep(LEASE_POLL)
            waited += LEASE_POLL
            st = get_status() or st
        action, sid = decide(st)
        if action in ("resume", "fallback"):
            takeover()
    print(action if not sid else f"{action} {sid}")
    print("sidecar " + " ".join((st or {}).get("recent_snapshots") or []))
    if dry:
        print(json.dumps(st, ensure_ascii=False)[:500], file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

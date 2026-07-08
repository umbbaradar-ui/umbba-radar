#!/usr/bin/env python3
"""
bd_recover_check.py — BD Instagram 스크레이퍼 장애 복구 감지기.

배경: 2026-06-28부터 dataset gd_lk5ns7kz21pck8jpis(Instagram-Posts, discover by url)가
parse_error로 0 records 반환(인스타 측 차단/파서 깨짐, BD 알려진 장애). BD 복구 ETA 미정.

동작: launchd가 1시간마다 호출. 소수 계정(TEST_ACCOUNTS)으로 가벼운 discover를 한 번 찔러보고
짧게 폴링(SHORT_TIMEOUT). 복구 신호가 보이면 텔레그램 1회 알림 + 자기 자신(launchd) 언로드.
아직 장애면 조용히 종료(다음 시간에 재시도).

복구 신호(아래 중 하나면 정상화로 판단):
    - records > 0                      (새 글을 정상 파싱해 가져옴)
    - success_rate > 0                 (BD가 일부라도 성공 처리)
    - errors > 0 인데 parse_error == 0  (실패가 parse_error 도배가 아님 = 파서 정상)
즉 "parse_error 도배 + success_rate 0"이 지속되는 동안만 장애로 본다.

과금: discover의 records만 과금. 장애 중엔 records 0 = 무과금. 복구 후 3계정 1글씩 ≈ 수원.

텔레그램: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID (.env) 있을 때만 전송. 없으면 조용히 스킵.
"""
from __future__ import annotations

import os
import sys
import time
import subprocess

import requests
from dotenv import load_dotenv

import bd_client

load_dotenv()

# 가볍게 찔러볼 계정(자주 글 올리는 곳일수록 복구 시 records로 빨리 확인됨).
TEST_ACCOUNTS = ["manyoofficial", "oldsoleskorea", "mmmshop.kr"]
RECENT = 1                 # 계정당 최근 1글만(부하·과금 최소)
SHORT_TIMEOUT = 180        # 초. 정상 BD면 3계정은 금방 끝남. 넘으면 "아직 장애"로 보고 종료.
POLL_EVERY = 10            # 초

LABEL = "com.umbba.bdcheck"
PLIST = os.path.expanduser(f"~/Library/LaunchAgents/{LABEL}.plist")
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bd-check-log.txt")


def log(msg: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def send_telegram(text: str) -> bool:
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
    if not token or not chat_id:
        log("텔레그램 미설정(.env에 TELEGRAM_BOT_TOKEN/CHAT_ID 없음) — 알림 스킵")
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text,
                  "parse_mode": "HTML", "disable_web_page_preview": True},
            timeout=30,
        )
        ok = r.status_code == 200 and (r.json() or {}).get("ok")
        log("텔레그램 전송 성공" if ok else f"텔레그램 전송 실패: {r.status_code} {r.text[:160]}")
        return bool(ok)
    except requests.RequestException as e:
        log(f"텔레그램 네트워크 오류: {e}")
        return False


def self_unload() -> None:
    """복구됐으니 더 안 돌게 자기 launchd 잡 언로드."""
    try:
        subprocess.run(["launchctl", "unload", PLIST], check=False,
                       capture_output=True, timeout=30)
        log(f"launchd 언로드 완료: {LABEL} (복구 감지로 자동 종료)")
    except Exception as e:
        log(f"launchd 언로드 실패(수동 해제 필요): {e}")


def short_poll(snapshot_id: str) -> dict | None:
    """ready까지 짧게만 대기. 시간 내 못 끝나면 None(아직 장애로 간주)."""
    waited = 0
    while waited < SHORT_TIMEOUT:
        p = bd_client.progress(snapshot_id)
        st = p.get("status", "?")
        log(f"   ...{st} ({waited}s) records={p.get('records')} "
            f"errors={p.get('errors')} success_rate={p.get('success_rate')}")
        if st == "ready":
            return p
        if st in ("failed", "error"):
            return p
        time.sleep(POLL_EVERY)
        waited += POLL_EVERY
    log(f"   짧은 폴링 타임아웃({SHORT_TIMEOUT}s) — 아직 정상화 안 됨(또는 여전히 느림)")
    return None


def is_recovered(p: dict) -> bool:
    records = p.get("records") or 0
    success_rate = p.get("success_rate") or 0
    error_codes = p.get("error_codes") or {}
    parse_err = error_codes.get("parse_error", 0) if isinstance(error_codes, dict) else 0
    errors = p.get("errors") or 0
    if records > 0:
        return True
    if success_rate and success_rate > 0:
        return True
    # 실패는 있는데 parse_error 도배가 아니면 파서는 정상 = 복구로 본다.
    if errors > 0 and parse_err == 0:
        return True
    return False


def main() -> int:
    if not bd_client.configured():
        log("BRIGHTDATA_API_TOKEN 없음 — 체크 불가, 종료")
        return 1

    log(f"BD 복구 체크 시작 — {TEST_ACCOUNTS} (recent={RECENT})")
    sid, err = bd_client.trigger_discover(TEST_ACCOUNTS, RECENT)
    if err or not sid:
        log(f"trigger 실패: {err} — 다음 시간 재시도")
        return 1
    log(f"snapshot={sid}")

    p = short_poll(sid)
    if not p:
        return 0  # 아직 장애/느림 — 조용히 종료(다음 시간 재시도)

    if is_recovered(p):
        log(f"✅ BD 복구 감지! records={p.get('records')} "
            f"success_rate={p.get('success_rate')} errors={p.get('errors')}")
        msg = (
            "🟢 <b>BD 스크레이퍼 복구 감지</b>\n\n"
            f"테스트 스캔에서 정상 신호 확인 (records={p.get('records')}, "
            f"success_rate={p.get('success_rate')}).\n"
            "인스타 수집 파이프라인이 다시 동작합니다.\n\n"
            "• 자동 복구체크는 종료됩니다(언로드).\n"
            "• 다음 새벽 3시 정규 수집부터 정상 진행 예상.\n"
            f"• 확인 스냅샷: {sid}"
        )
        send_telegram(msg)
        self_unload()
        return 0

    error_codes = p.get("error_codes") or {}
    log(f"아직 장애 지속 — status={p.get('status')} records={p.get('records')} "
        f"error_codes={error_codes} — 다음 시간 재시도")
    return 0


if __name__ == "__main__":
    sys.exit(main())

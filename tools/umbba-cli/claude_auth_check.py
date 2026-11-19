#!/usr/bin/env python3
"""
claude_auth_check.py — 헤드리스 claude 로그인이 "언제" 끊길지 미리 알린다.

배경(2026-11-19 규명):
  분류 전면 정지가 2026-09-18 / 10-17 / 11-18 에 약 한 달 간격으로 재발했다. 우연이 아니라
  구독 로그인(claudeAiOauth)의 **refresh token 이 30일 만료**라서다. 만료되면 헤드리스
  `claude -p` 가 "OAuth session expired" 로 전량 실패하고, 사람이 터미널에서 다시 로그인할
  때까지(=평균 이틀) 카드가 한 장도 안 올라갔다.
  - accessToken: 몇 시간짜리 — refresh token 으로 자동 갱신되니 신경 쓸 필요 없음
  - refreshToken: 30일 — 이게 만료되는 날이 곧 "분류 멈추는 날"
  만료일은 macOS 키체인 항목("Claude Code-credentials")의 refreshTokenExpiresAt 에 들어 있어
  **미리 읽을 수 있다.** 그래서 만료 N일 전에 텔레그램으로 예고하고, 은재가 편한 시간에
  터미널에서 재로그인하면 정지 시간이 0이 된다.

  ※ CLAUDE_CODE_OAUTH_TOKEN(`claude setup-token`) 방식은 2026-07 / 09 두 번 폐기를 겪어
    .env 에 "활성화 금지"로 못박혀 있다. 그래서 토큰이 아니라 "예고"로 해결한다.

쓰는 법:
  python3 claude_auth_check.py            # bd-run.sh 가 매일 1회 호출(만료 임박일 때만 발송)
  python3 claude_auth_check.py --dry-run   # 발송 대신 보낼 문구만 출력
  python3 claude_auth_check.py --days 7    # 예고 시작 시점(기본 3일 전)
  python3 claude_auth_check.py --any-hour  # 발송 시간대(08~22시) 무시
발송 시간대: 새벽 3시 알림은 못 보고 넘기니, 실제 발송은 08~22시에만 한다(bd-queue.sh 가
매시 불러서 그날 첫 주간 회차에 보냄). 그 바깥 시간대에는 로그만 남기고 다음 회차로 넘긴다.
비밀 취급: 토큰 값은 절대 읽지도, 찍지도 않는다(만료 시각 필드만 꺼낸다).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv  # bd_notify 가 .env 의 텔레그램 키를 쓴다
    load_dotenv(Path(__file__).with_name(".env"))
except Exception:
    pass

import bd_notify

KEYCHAIN_SERVICE = "Claude Code-credentials"
STATE_FILE = Path(__file__).with_name(".claude-auth-warn.json")
DEFAULT_WARN_DAYS = 3
SEND_FROM_HOUR, SEND_TO_HOUR = 8, 22  # 사람이 보는 시간대에만 발송


def read_refresh_expiry() -> tuple[dt.datetime | None, str]:
    """키체인에서 refresh token 만료 시각만 꺼낸다. (시각, 상태문자열)"""
    try:
        p = subprocess.run(
            ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
            capture_output=True, text=True, timeout=20,
        )
    except (OSError, subprocess.SubprocessError) as e:
        return None, f"읽기 실패({type(e).__name__})"
    if p.returncode != 0:
        err = (p.stderr or "").strip()
        if "could not be found" in err:
            return None, "항목 없음(로그아웃 상태)"
        return None, f"읽기 실패(rc={p.returncode})"
    try:
        oauth = json.loads(p.stdout).get("claudeAiOauth") or {}
        ms = oauth.get("refreshTokenExpiresAt")
        if not isinstance(ms, (int, float)):
            return None, "만료 필드 없음"
        return dt.datetime.fromtimestamp(ms / 1000), "ok"
    except (ValueError, TypeError, AttributeError):
        return None, "형식 해석 실패"


def already_warned_today(expiry_key: str) -> bool:
    """같은 만료일에 대해 하루 한 번만 발송(수동 실행 중복 방지)."""
    try:
        st = json.loads(STATE_FILE.read_text())
        return st.get("date") == dt.date.today().isoformat() and st.get("expiry") == expiry_key
    except (OSError, ValueError):
        return False


def remember_warned(expiry_key: str) -> None:
    try:
        STATE_FILE.write_text(json.dumps(
            {"date": dt.date.today().isoformat(), "expiry": expiry_key}, ensure_ascii=False))
    except OSError:
        pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=int(os.getenv("UMBBA_AUTH_WARN_DAYS", DEFAULT_WARN_DAYS)),
                    help=f"며칠 전부터 예고할지(기본 {DEFAULT_WARN_DAYS})")
    ap.add_argument("--dry-run", action="store_true", help="발송 대신 문구만 출력")
    ap.add_argument("--any-hour", action="store_true",
                    help=f"발송 시간대({SEND_FROM_HOUR}~{SEND_TO_HOUR}시) 제한 무시")
    args = ap.parse_args()

    now = dt.datetime.now()
    expiry, status = read_refresh_expiry()

    if expiry is None:
        print(f"   ⚠️ claude 로그인 수명 확인 불가 — {status}")
        if status == "항목 없음(로그아웃 상태)":
            lines = ["헤드리스 claude 자격이 키체인에 없어요 — 분류가 전량 실패합니다."]
            action = "맥 터미널에서 <code>claude</code> 실행 → 로그인 후 추격 실행"
            if args.dry_run:
                print(f"   [dry-run] 🔴 claude 로그인 끊김 / {lines} / {action}")
            elif already_warned_today("logged-out"):
                print("   ⓘ 오늘 이미 발송 — 스킵")
            elif args.any_hour or SEND_FROM_HOUR <= now.hour <= SEND_TO_HOUR:
                if bd_notify.alert("claude 로그인 끊김", lines, action, icon="🔴"):
                    remember_warned("logged-out")
            else:
                print(f"   ⓘ 발송 시간대 아님({SEND_FROM_HOUR}~{SEND_TO_HOUR}시) — 다음 회차에 발송")
            return 2
        return 0  # 확인 실패는 조용히(무인 루틴을 알림 때문에 흔들지 않음)

    left = expiry - now
    hours = left.days * 24 + left.seconds // 3600
    print(f"   🔑 claude 로그인 수명: {expiry:%Y-%m-%d %H:%M} 만료 "
          f"(D{left.days:+d}, {hours}시간 남음)")

    if hours > args.days * 24:
        return 0  # 아직 여유 — 조용히

    expiry_key = expiry.strftime("%Y-%m-%dT%H:%M")
    if already_warned_today(expiry_key):
        print("   ⓘ 오늘 이미 예고 발송 — 스킵")
        return 0
    if not (args.dry_run or args.any_hour or SEND_FROM_HOUR <= now.hour <= SEND_TO_HOUR):
        print(f"   ⓘ 만료 임박(D{left.days:+d})이지만 발송 시간대 아님"
              f"({SEND_FROM_HOUR}~{SEND_TO_HOUR}시) — 다음 회차에 발송")
        return 0

    expired = hours <= 0
    icon = "🔴" if expired else "🟡"
    title = "claude 로그인 만료" if expired else "claude 로그인 곧 만료"
    when = f"{expiry:%m/%d %H:%M}"
    lines = (
        [f"{when} 에 만료됐어요 — 지금 분류가 멈춰 있습니다(카드 0장)."]
        if expired else
        [f"{when} 만료 — 그 뒤 새벽 분류가 전량 실패합니다(남은 시간 {hours}h).",
         "30일 주기라 매달 같은 일이 생겨요. 만료 전에 재로그인하면 정지 0."]
    )
    action = "맥 터미널에서 <code>claude</code> 실행 → 로그인(브라우저 승인) → 끝"
    if args.dry_run:
        print(f"   [dry-run] {icon} {title}")
        for ln in lines:
            print(f"   [dry-run]   {ln}")
        print(f"   [dry-run]   👉 {action}")
        return 1
    if bd_notify.alert(title, lines, action, icon=icon):
        remember_warned(expiry_key)
    return 1


if __name__ == "__main__":
    sys.exit(main())

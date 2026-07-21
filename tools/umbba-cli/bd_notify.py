#!/usr/bin/env python3
"""
bd_notify.py — 무인 루틴(launchd) 장애를 텔레그램으로 즉시 알리는 공용 발송부.

배경: 2026-07-16~07-21 CLAUDE_CODE_OAUTH_TOKEN이 revoke되어 분류가 6일간 3,210배치
전면 실패했으나 알림이 하나도 없었음(텔레그램은 "수집 정상"만 보고 있었음).
같은 침묵을 막으려고 실패 신호를 여기로 모은다.

.env의 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 사용. 미설정이면 조용히 no-op(무인 루틴을
알림 설정 때문에 실패시키지 않기 위함).
"""
from __future__ import annotations

import os

import requests


def send_telegram(text: str) -> bool:
    """텔레그램 발송. 미설정·오류여도 예외 안 냄(호출부 흐름 보호)."""
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
    if not token or not chat_id:
        print("   ⓘ 텔레그램 미설정(.env TELEGRAM_BOT_TOKEN/CHAT_ID) — 알림 스킵")
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text,
                  "parse_mode": "HTML", "disable_web_page_preview": True},
            timeout=30,
        )
        ok = r.status_code == 200 and (r.json() or {}).get("ok")
        print("   ✅ 텔레그램 경고 전송" if ok
              else f"   ⚠ 텔레그램 전송 실패: {r.status_code} {r.text[:160]}")
        return bool(ok)
    except requests.RequestException as e:
        print(f"   ⚠ 텔레그램 네트워크 오류: {e}")
        return False


def alert(title: str, lines: list[str], action: str = "") -> bool:
    """장애 경고 한 건. title=한 줄 요약, lines=근거, action=사람이 할 일."""
    body = [f"🚨 <b>{title}</b>", ""] + lines
    if action:
        body += ["", f"👉 {action}"]
    return send_telegram("\n".join(body))

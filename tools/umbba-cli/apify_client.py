#!/usr/bin/env python3
"""
apify_client.py — 예비 수집기 2: Apify 공식 Actor `apify~instagram-post-scraper` (게시물 1건당 과금, 새 글 없는 계정 0원).
HikerAPI(예비 1)가 미설정·잔액 0·실패일 때 bd_ingest 가 남은 계정을 넘긴다. 무료 플랜(카드 불필요) 월 크레딧으로도 동작.
수집은 Apify 설비로 — 우리 인스타 계정은 안 씀.

환경변수(.env):
    APIFY_TOKEN         (필수 — Apify Console > Settings > API & Integrations 의 Personal API token)
    APIFY_MAX_USD       (1회 실행 비용 상한 USD, 기본 1.5 → run 의 maxTotalChargeUsd)
흐름: 계정 목록 한 번에 run(onlyPostsNewerThan·resultsLimit·skipPinnedPosts) → 폴링 → dataset items
      → BD 레코드 모양 변환(URL 은 BD 와 동일 /p/코드/·/reel/코드/) → bd_ingest.process_records 재사용.
"""
from __future__ import annotations

import datetime as dt
import os
import re
import time

import requests
from dotenv import load_dotenv

load_dotenv()
NAME, ENV_KEY = "Apify", "APIFY_TOKEN"
TOKEN = (os.getenv("APIFY_TOKEN") or "").strip()
MAX_USD = float(os.getenv("APIFY_MAX_USD") or 1.5)
ACTOR = "apify~instagram-post-scraper"
BASE = "https://api.apify.com/v2"
USD_PER_RESULT = 0.0027       # 무료 플랜 $2.70/1k (Starter $2.30)
WON_PER_USD = 1400
POLL_EVERY, POLL_TIMEOUT = 15, 2400
_USER = re.compile(r"instagram\.com/([^/?#]+)")


def configured() -> bool:
    return bool(TOKEN)


def _auth() -> dict:
    return {"Authorization": f"Bearer {TOKEN}"}


def _limits() -> tuple[float, float] | None:
    """(이번 달 사용 USD, 월 한도 USD). 실패면 None."""
    try:
        r = requests.get(f"{BASE}/users/me/limits", headers=_auth(), timeout=30)
        d = (r.json() or {}).get("data") or {}
        used = float((d.get("current") or {}).get("monthlyUsageUsd") or 0)
        cap = float((d.get("limits") or {}).get("maxMonthlyUsageUsd") or 0)
        return (used, cap) if r.status_code == 200 else None
    except (requests.RequestException, ValueError, TypeError):
        return None


def balance_info() -> tuple[str, bool]:
    """(표시 문자열, 충전·한도 부족?) — 남은 월 크레딧 $1 미만이면 부족."""
    lim = _limits()
    if not lim:
        return "사용량 조회 실패", False
    used, cap = lim
    return f"이번 달 ${used:.2f}/${cap:.2f} 사용", (cap - used) < 1


def ready() -> tuple[bool, str]:
    """돌릴 수 있나(무료 호출). 월 한도 소진이면 False."""
    lim = _limits()
    if lim and lim[1] and lim[0] >= lim[1] - 0.05:
        return False, f"월 사용 한도 소진(${lim[0]:.2f}/${lim[1]:.2f})"
    return True, ""


def _user_of(item: dict) -> str:
    u = item.get("ownerUsername") or item.get("username")
    if not u:
        m = _USER.search(item.get("inputUrl") or "")
        u = m.group(1) if m else ""
    return (u or "").strip().lstrip("@").lower()


def to_record(it: dict) -> dict | None:
    """Apify 게시물 → BD 레코드 모양. URL 은 BD 와 글자까지 같게(서버 중복 체크가 source_url 정확 일치)."""
    code, ts = it.get("shortCode"), it.get("timestamp")
    if not code or not ts:
        return None
    t = it.get("type") or ""
    # basicData 엔 productType 이 없다. BD 는 동영상을 전부 Reel·/reel/ 로 준다(10-21 스냅샷 84/84) → Video = 릴스
    reel = it.get("productType") == "clips" or t == "Video"
    ctype = "Reel" if reel else ("Carousel" if t == "Sidecar" else "Image")
    img = it.get("displayUrl") or ((it.get("images") or [None])[0])
    kids = [c for c in (it.get("childPosts") or []) if isinstance(c, dict)]
    alts = [{"type": "Photo", "url": c.get("displayUrl"), "index": i, "alt_text": c.get("alt")}
            for i, c in enumerate(kids) if c.get("alt")]
    if not alts and it.get("alt"):
        alts = [{"type": "Photo", "url": img, "index": 0, "alt_text": it["alt"]}]
    try:
        when = dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except ValueError:
        return None
    return {
        "url": f"https://www.instagram.com/{'reel' if reel else 'p'}/{code}/",
        "description": it.get("caption") or "",
        "user_posted": it.get("ownerUsername") or _user_of(it),
        "date_posted": when.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "content_type": ctype,
        "photos": [img] if img else [],
        "thumbnail": img,
        "post_content": alts or None,
        "is_paid_partnership": it.get("isSponsored"),
        "_provider": "apify",
    }


def discover(usernames: list[str], recent: int, since: dict[str, dt.date], default_since: dt.date | None,
             max_usd: float | None = None, log=print) -> tuple[list[dict], dict]:
    """계정 목록을 한 번에 run. (BD 모양 records, stats) — stats 키는 hiker_client.discover 와 같다."""
    names = [u.strip().lstrip("@").lower() for u in usernames if u.strip()]
    st = {"accounts": len(names), "scanned": 0, "requests": 0, "won": 0, "notfound": 0, "errors": 0,
          "budget_stop": False, "no_funds": False, "scanned_users": [], "notfound_users": [], "results": 0}
    if not names:
        return [], st
    cap = max_usd or MAX_USD
    floors = [d for d in [default_since, *since.values()] if d]
    inp = {"username": names, "resultsLimit": recent, "skipPinnedPosts": True, "dataDetailLevel": "basicData"}
    if floors:
        inp["onlyPostsNewerThan"] = min(floors).isoformat()          # 가장 이른 기준으로 받고 계정별로 다시 거름
    try:
        r = requests.post(f"{BASE}/acts/{ACTOR}/runs", headers=_auth(), json=inp, timeout=60,
                          params={"maxTotalChargeUsd": cap, "maxItems": len(names) * recent, "timeout": POLL_TIMEOUT})
    except requests.RequestException as e:
        log(f"   ❌ Apify 시작 오류: {e}"); st["errors"] = len(names); return [], st
    if r.status_code == 402:
        st["no_funds"] = True; log("   ❌ Apify 402 — 크레딧 부족"); return [], st
    if r.status_code not in (200, 201):
        log(f"   ❌ Apify 시작 HTTP {r.status_code}: {r.text[:160]}"); st["errors"] = len(names); return [], st
    run = (r.json() or {}).get("data") or {}
    rid, ds = run.get("id"), run.get("defaultDatasetId")
    log(f"   apify run={rid}")
    waited, status = 0, run.get("status")
    while status in ("READY", "RUNNING") and waited < POLL_TIMEOUT + 120:
        try:
            p = requests.get(f"{BASE}/actor-runs/{rid}", headers=_auth(), params={"waitForFinish": 60}, timeout=90)
            run = (p.json() or {}).get("data") or run
        except (requests.RequestException, ValueError):
            time.sleep(POLL_EVERY)
        status = run.get("status"); waited += 60
    usd = float(run.get("usageTotalUsd") or 0)
    if status != "SUCCEEDED":
        log(f"   ⚠ Apify run {status} — 받은 만큼만 처리")
    items: list[dict] = []
    for off in range(0, 100_000, 1000):
        try:
            g = requests.get(f"{BASE}/datasets/{ds}/items", headers=_auth(),
                             params={"clean": "true", "format": "json", "offset": off, "limit": 1000}, timeout=120)
            page = g.json() if g.status_code == 200 else []
        except (requests.RequestException, ValueError):
            page = []
        items += page if isinstance(page, list) else []
        if not isinstance(page, list) or len(page) < 1000:
            break
    out, seen_users, nf, bad = [], set(), set(), set()
    for it in items:
        u = _user_of(it)
        if it.get("error"):     # 오류 행: {"inputUrl", "error": "not_found", "errorDescription"} 등
            msg = f"{it.get('error')} {it.get('errorDescription', '')}".lower()
            if "no_items" in msg:     # 기간 안 새 글 없음(실측 2026-10-27 pamperskr) = 정상 조회
                continue
            (nf if ("not_found" in msg or "not found" in msg or "doesn't exist" in msg) else bad).add(u)
            continue
        rec = to_record(it)
        if not rec:
            continue
        floor = since.get(u, default_since)
        if floor and rec["date_posted"][:10] < floor.isoformat():
            continue
        seen_users.add(u); out.append(rec)
    st["results"] = len(items)
    st["budget_stop"] = usd >= cap * 0.97
    if status == "SUCCEEDED" and not st["budget_stop"]:
        st["scanned_users"] = [u for u in names if u not in nf and u not in bad]   # 새 글 없는 계정은 결과 0이어도 조회 완료
        st["errors"] = len(bad)
    else:
        st["scanned_users"] = sorted(seen_users)
        st["errors"] = len(names) - len(seen_users) - len(nf)
    st["notfound_users"] = sorted(nf)
    st["notfound"] = len(nf)
    st["scanned"] = len(st["scanned_users"])
    st["won"] = round((usd or len(items) * USD_PER_RESULT) * WON_PER_USD)
    return out, st

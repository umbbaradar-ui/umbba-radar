#!/usr/bin/env python3
"""
hiker_client.py — 예비 수집기: HikerAPI(인스타 공개 데이터 API, 요청당 과금).
BD 계정 스캔이 죽었을 때(2026-10-22 crawl_error 'pk' 사례) bd_ingest 가 같은 실행 안에서 자동 전환한다.
수집은 HikerAPI 자체 설비로 — 우리 인스타 계정은 안 씀(정지 위험 0).

환경변수(.env):
    HIKERAPI_KEY        (필수 — 없으면 configured()=False, bd_ingest 는 "예비 미설정" 경보만)
    HIKER_MAX_REQUESTS  (1회 실행 요청 상한, 기본 700 ≈ $0.7)
흐름: username → user_id(.hiker-pk-cache.json 영구 캐시, 첫 1회만 과금) → /g2/user/medias 한 페이지(1요청)
      → 날짜·개수 필터 → BD 레코드 모양(url/description/user_posted/date_posted/photos…)으로 변환
      → bd_ingest.process_records 그대로 재사용(카드 생성·중복 체크·이미지 fetch 동일).
과금: 200·400·403·404 응답 과금, 5xx 무과금, /sys/balance 무료.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()
NAME, ENV_KEY = "HikerAPI", "HIKERAPI_KEY"
KEY = (os.getenv("HIKERAPI_KEY") or "").strip()
MAX_REQUESTS = int(os.getenv("HIKER_MAX_REQUESTS") or 700)
BASE = "https://api.hikerapi.com"
PK_CACHE = Path(__file__).with_name(".hiker-pk-cache.json")
WON_PER_REQ = 1.4          # $1/1k 요청 × 1,400원 (볼륨 구간 $0.6/1k)
SLEEP = 0.2


def configured() -> bool:
    return bool(KEY)


class Budget:
    def __init__(self, cap: int):
        self.cap, self.used = cap, 0

    def take(self) -> bool:
        if self.used >= self.cap:
            return False
        self.used += 1
        return True


def _get(path: str, params: dict, budget: Budget | None) -> tuple[int, object]:
    """(status, json|None). 상한 넘으면 (-1, None). 5xx·네트워크는 1회 재시도(무과금)."""
    for attempt in range(2):
        if budget is not None and not budget.take():
            return -1, None
        try:
            r = requests.get(f"{BASE}{path}", params=params, headers={"x-access-key": KEY}, timeout=40)
        except requests.RequestException:
            if budget is not None:
                budget.used -= 1          # 응답 없음 = 과금 없음
            time.sleep(2); continue
        if r.status_code >= 500:
            if budget is not None:
                budget.used -= 1
            time.sleep(2); continue
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, None
    return 599, None


def balance() -> dict | None:
    """잔액·남은 요청(무료 호출). 미설정·실패면 None."""
    if not KEY:
        return None
    st, d = _get("/sys/balance", {}, None)
    return d if st == 200 and isinstance(d, dict) else None


def balance_line(b: dict | None) -> tuple[str, bool]:
    """(표시 문자열, 충전 필요?) — 응답 필드명이 문서에 없어 있는 것만 표시. 기준: $2 미만 또는 1,500요청 미만(≈ 이틀치)."""
    if not b:
        return "잔액 조회 실패", False
    amount = next((b[k] for k in ("amount", "balance", "money") if isinstance(b.get(k), (int, float))), None)
    reqs = next((b[k] for k in ("requests", "requests_left") if isinstance(b.get(k), (int, float))), None)
    parts = ([f"${amount:.2f}"] if amount is not None else []) + ([f"{int(reqs):,}요청"] if reqs is not None else [])
    low = (amount is not None and amount < 2) or (reqs is not None and reqs < 1500)
    return ("잔액 " + " · ".join(parts)) if parts else f"잔액 {str(b)[:80]}", low


def balance_info() -> tuple[str, bool]:
    return balance_line(balance())


def ready() -> tuple[bool, str]:
    """돌릴 수 있나(무료 호출). 잔액·요청 모두 0이면 False — 요청마다 402 라 시작하지 않는다."""
    b = balance()
    if b and (b.get("amount") or 0) <= 0 and (b.get("requests") or 0) <= 0:
        return False, "잔액 0 — hikerapi.com/billing 충전 필요"
    return True, ""


def _load_pk() -> dict:
    try:
        return json.loads(PK_CACHE.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def _items(payload) -> list[dict]:
    """응답 모양이 버전마다 달라(리스트 / {response:{items}} / [items, cursor] / GraphQL edges) 미디어 dict 목록만 뽑는다."""
    def is_media(x):
        return isinstance(x, dict) and any(k in x for k in ("code", "shortcode", "taken_at", "taken_at_timestamp"))
    stack = [payload]
    while stack:
        cur = stack.pop(0)
        if isinstance(cur, list):
            if cur and all(isinstance(x, dict) for x in cur):
                nodes = [x.get("node", x) for x in cur]
                if any(is_media(n) for n in nodes):
                    return [n for n in nodes if is_media(n)]
            stack.extend(cur)
        elif isinstance(cur, dict):
            stack.extend(cur.values())
    return []


def _ts(m: dict) -> dt.datetime | None:
    v = m.get("taken_at") or m.get("taken_at_timestamp") or m.get("taken_at_ts")
    try:
        if isinstance(v, (int, float)) or (isinstance(v, str) and v.isdigit()):
            return dt.datetime.fromtimestamp(int(v), dt.timezone.utc)
        if isinstance(v, str):
            return dt.datetime.fromisoformat(v.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except (ValueError, OSError):
        pass
    return None


def _img(m: dict) -> str | None:
    for k in ("thumbnail_url", "display_url"):
        if m.get(k):
            return str(m[k])
    cands = ((m.get("image_versions2") or {}).get("candidates") or [])
    if cands and cands[0].get("url"):
        return cands[0]["url"]
    for res in (m.get("resources") or m.get("carousel_media") or []):
        u = _img(res) if isinstance(res, dict) else None
        if u:
            return u
    return None


def to_record(m: dict, username: str) -> dict | None:
    """HikerAPI 미디어 → BD 레코드 모양. URL 은 BD 와 글자까지 같게(/p/코드/, 릴스 /reel/코드/) — 서버 중복 체크가 정확 일치."""
    code = m.get("code") or m.get("shortcode")
    when = _ts(m)
    if not code or not when:
        return None
    mt = m.get("media_type")
    # BD 는 동영상을 전부 Reel·/reel/ 로 준다(10-21 스냅샷 84/84) → 동영상 = 릴스
    reel = (m.get("product_type") == "clips" or mt == 2 or bool(m.get("is_video"))
            or m.get("__typename") in ("GraphVideo", "XDTGraphVideo"))
    ctype = "Reel" if reel else ("Carousel" if (mt == 8 or m.get("resources") or m.get("carousel_media")) else "Image")
    cap = m.get("caption_text")
    if cap is None:
        c = m.get("caption")
        cap = c.get("text") if isinstance(c, dict) else (c if isinstance(c, str) else None)
    if cap is None:
        edges = ((m.get("edge_media_to_caption") or {}).get("edges") or [])
        cap = edges[0]["node"].get("text") if edges else ""
    img = _img(m)
    alts = [r.get("accessibility_caption") for r in (m.get("resources") or m.get("carousel_media") or [])
            if isinstance(r, dict) and r.get("accessibility_caption")]
    user = (m.get("user") or m.get("owner") or {}).get("username") or username
    return {
        "url": f"https://www.instagram.com/{'reel' if reel else 'p'}/{code}/",
        "description": cap or "",
        "user_posted": user,
        "date_posted": when.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "content_type": ctype,
        "photos": [img] if img else [],
        "thumbnail": img,
        "post_content": [{"type": "Photo", "url": img, "index": 0, "alt_text": a} for a in alts] if alts else None,
        "is_paid_partnership": m.get("is_paid_partnership"),
        "_provider": "hiker",
    }


def discover(usernames: list[str], recent: int, since: dict[str, dt.date], default_since: dt.date | None,
             max_requests: int | None = None, log=print) -> tuple[list[dict], dict]:
    """계정별 최근 recent개(since 이후). (BD 모양 records, stats).
    stats = {accounts, scanned, requests, won, notfound, errors, budget_stop, cached_pk}"""
    budget = Budget(max_requests or MAX_REQUESTS)
    pk = _load_pk(); pk_dirty = False
    out: list[dict] = []
    st = {"accounts": len(usernames), "scanned": 0, "requests": 0, "won": 0, "notfound": 0,
          "errors": 0, "budget_stop": False, "no_funds": False, "cached_pk": 0, "scanned_users": [], "notfound_users": []}
    for u in usernames:
        uname = u.strip().lstrip("@").lower()
        uid = pk.get(uname)
        if uid:
            st["cached_pk"] += 1
        else:
            code, d = _get("/v1/user/by/username", {"username": uname}, budget)
            if code == -1:
                st["budget_stop"] = True; break
            if code == 402:                       # InsufficientFunds — 나머지도 전부 거절이라 즉시 중단
                st["no_funds"] = True; break
            uid = str(d.get("pk") or d.get("id") or "") if code == 200 and isinstance(d, dict) else ""
            if not uid:
                st["notfound" if code == 404 else "errors"] += 1
                if code == 404:
                    st["notfound_users"].append(uname)
                log(f"   ⚠ @{uname} user 조회 실패 (HTTP {code})"); time.sleep(SLEEP); continue
            pk[uname] = uid; pk_dirty = True
        code, d = _get("/g2/user/medias", {"user_id": uid}, budget)
        if code == -1:
            st["budget_stop"] = True; break
        if code == 402:
            st["no_funds"] = True; break
        if code != 200:
            st["notfound" if code == 404 else "errors"] += 1
            if code == 404:
                st["notfound_users"].append(uname)
            log(f"   ⚠ @{uname} medias 실패 (HTTP {code})")
            if code == 404:
                pk.pop(uname, None); pk_dirty = True     # 계정 삭제·변경 → 다음엔 다시 조회
            time.sleep(SLEEP); continue
        st["scanned"] += 1; st["scanned_users"].append(uname)
        floor = since.get(uname, default_since)
        recs = [r for r in (to_record(m, uname) for m in _items(d)) if r]
        recs.sort(key=lambda r: r["date_posted"], reverse=True)     # 고정 게시물이 맨 앞에 와도 날짜순
        if floor:
            recs = [r for r in recs if r["date_posted"][:10] >= floor.isoformat()]
        out.extend(recs[:recent])
        time.sleep(SLEEP)
    if pk_dirty:
        PK_CACHE.write_text(json.dumps(pk, separators=(",", ":")), encoding="utf-8")
    st["requests"] = budget.used
    st["won"] = round(budget.used * WON_PER_REQ)
    return out, st

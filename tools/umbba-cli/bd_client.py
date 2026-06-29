#!/usr/bin/env python3
"""
bd_client.py — Bright Data "Instagram - Posts / discover by url" 공용 클라이언트.

운영 러너(bd_ingest.py)와 PoC 검증(bd_scan.py)이 공유하는 BD API 래퍼.
인스타를 직접 안 건드리고(쿠키 X) BD가 긁어온 JSON + CDN 이미지 URL만 다룬다.

환경변수(.env):
    BRIGHTDATA_API_TOKEN  (필수)
    BRIGHTDATA_DATASET_ID (선택, 기본 gd_lk5ns7kz21pck8jpis = Instagram-Posts 데이터셋)

핵심 함수:
    trigger_discover(usernames, recent, start_date) -> (snapshot_id, err)
    wait_ready(snapshot_id)                          -> (ok, progress_dict)  # records/errors 분해 포함
    fetch_snapshot(snapshot_id)                      -> (records, err)
    map_record(rec)                                  -> 우리 items dict
    fetch_cdn_image(url)                             -> (bytes, mime, err)    # 로그인 X
"""
from __future__ import annotations

import os
import time

import requests
from dotenv import load_dotenv

# import 순서와 무관하게 .env 보장 (idempotent)
load_dotenv()

API_TOKEN = (os.getenv("BRIGHTDATA_API_TOKEN") or "").strip()
DATASET_ID = (os.getenv("BRIGHTDATA_DATASET_ID") or "gd_lk5ns7kz21pck8jpis").strip()

BASE = "https://api.brightdata.com/datasets/v3"
CAPTION_MAX = 2000        # DB·UI 정책과 동일
POLL_EVERY = 8            # 초
POLL_TIMEOUT = 600        # 초 (10분)


def configured() -> bool:
    return bool(API_TOKEN)


def _auth() -> dict:
    return {"Authorization": f"Bearer {API_TOKEN}"}


# ============================================
# 1) trigger — discover by url (비동기). 여러 계정 = input 배열 1회 = 폴링 1번.
# ============================================
def trigger_discover(usernames: list[str], recent: int, start_date: str = "",
                     start_dates: dict[str, str] | None = None) -> tuple[str | None, str | None]:
    """start_dates: {username(lower): start_date} — 계정별 start_date 오버라이드(신규=과거 N일 백필).
    없는 계정은 공통 start_date 사용. 한 호출 안에서 계정마다 다른 창을 줄 수 있음."""
    sd_map = {k.lower(): v for k, v in (start_dates or {}).items()}
    inputs = [
        {
            "url": f"https://www.instagram.com/{u.strip().lstrip('@')}",
            "num_of_posts": recent,
            # 계정별 오버라이드 우선, 없으면 공통 start_date. 비면 최근 recent개(신규필터 없음).
            "start_date": sd_map.get(u.strip().lstrip("@").lower(), start_date) or "",
            "end_date": "",
            "post_type": "",                   # 빈칸 = Post/Reel 전체
        }
        for u in usernames
    ]
    params = {
        "dataset_id": DATASET_ID,
        "include_errors": "true",
        "type": "discover_new",
        "discover_by": "url",
    }
    try:
        r = requests.post(
            f"{BASE}/trigger",
            headers={**_auth(), "Content-Type": "application/json"},
            params=params, json={"input": inputs}, timeout=60,
        )
    except requests.RequestException as e:
        return None, f"trigger 네트워크 오류: {e}"
    if r.status_code != 200:
        return None, f"trigger HTTP {r.status_code}: {r.text[:200]}"
    try:
        sid = (r.json() or {}).get("snapshot_id")
    except Exception:
        return None, f"trigger 응답 파싱 실패: {r.text[:200]}"
    return (sid, None) if sid else (None, f"snapshot_id 없음: {r.text[:200]}")


# ============================================
# 2) progress / 폴링.  progress는 {status, records(과금), errors(무과금=dead_page 등)} 분해 제공.
# ============================================
def progress(snapshot_id: str) -> dict:
    try:
        r = requests.get(f"{BASE}/progress/{snapshot_id}", headers=_auth(), timeout=30)
        return r.json() if r.status_code == 200 else {"status": f"http{r.status_code}"}
    except requests.RequestException as e:
        return {"status": f"err:{e}"}


def wait_ready(snapshot_id: str, log=print) -> tuple[bool, dict]:
    waited = 0
    while waited < POLL_TIMEOUT:
        p = progress(snapshot_id)
        st = p.get("status", "?")
        log(f"   ...{st} ({waited}s)")
        if st == "ready":
            return True, p
        if st in ("failed", "error"):
            return False, p
        time.sleep(POLL_EVERY)
        waited += POLL_EVERY
    return False, {"status": "timeout"}


# ============================================
# 3) snapshot 데이터
# ============================================
def fetch_snapshot(snapshot_id: str, retries: int = 15, wait: int = 30,
                   log=print) -> tuple[list[dict], str | None]:
    """progress=ready 직후에도 데이터 빌드 시차로 202(building)가 올 수 있음
    (특히 계정 많은 대형 스냅샷) -> 202면 대기 후 재시도."""
    url = f"{BASE}/snapshot/{snapshot_id}"
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=_auth(), params={"format": "json"}, timeout=120)
        except requests.RequestException as e:
            return [], f"snapshot 네트워크 오류: {e}"
        if r.status_code == 200:
            try:
                data = r.json()
            except Exception:
                return [], f"snapshot 파싱 실패: {r.text[:200]}"
            return (data if isinstance(data, list) else data.get("data", []) or []), None
        if r.status_code == 202:
            log(f"   snapshot building... 재시도 {attempt + 1}/{retries} ({wait}s 대기)")
            time.sleep(wait)
            continue
        return [], f"snapshot HTTP {r.status_code}: {r.text[:200]}"
    return [], f"snapshot 빌드 타임아웃 ({retries}회 재시도)"


# ============================================
# 4) 레코드 -> 우리 items dict (ingest.py scan_one_account 출력과 동일 + image_url)
# ============================================
def _first_photo(rec: dict) -> str | None:
    """post_content 중 type=Photo 첫 장(index 정렬) > photos[0]. 영상 url(.mp4)은 건너뜀."""
    pc = rec.get("post_content")
    if isinstance(pc, list) and pc:
        photos_only = [x for x in pc if isinstance(x, dict)
                       and (x.get("type") or "").lower() == "photo"]
        photos_only.sort(key=lambda x: x.get("index", 0))
        if photos_only and photos_only[0].get("url"):
            return photos_only[0]["url"]
    photos = rec.get("photos")
    if isinstance(photos, list) and photos:
        return photos[0]
    return None


def first_image(rec: dict) -> str | None:
    """대표 이미지(JPG). 캐러셀/이미지는 첫 사진, 영상(릴스)은 mp4가 아니라 thumbnail."""
    ct = (rec.get("content_type") or "").lower()
    thumb = rec.get("thumbnail")
    if ct in ("video", "reel"):
        return thumb or _first_photo(rec)
    return _first_photo(rec) or thumb


def map_record(rec: dict) -> dict | None:
    url = rec.get("url")
    if not url:
        return None
    desc = rec.get("description") or ""
    return {
        "url": url,
        "source_username": rec.get("user_posted"),
        "source_post_date": rec.get("date_posted"),     # 이미 ISO8601
        "caption_preview": desc[:CAPTION_MAX] if desc else None,
        "image_url": first_image(rec),
        "content_type": rec.get("content_type"),
        "is_ad": rec.get("is_paid_partnership"),
    }


# ============================================
# 5) CDN 이미지 다운 (로그인 X — 인스타 CDN은 공개 fetch 가능. ④ 다운로드 대체)
# ============================================
def fetch_cdn_image(url: str, timeout: int = 30) -> tuple[bytes | None, str | None, str | None]:
    """반환 (bytes, mime, err). 인스타 CDN URL은 oe= 만료 전에 받아 Storage로 옮겨야 함."""
    try:
        r = requests.get(url, timeout=timeout)
    except requests.RequestException as e:
        return None, None, str(e)
    if r.status_code != 200:
        return None, None, f"HTTP {r.status_code}"
    ct = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    mime = ct if ct.startswith("image/") else "image/jpeg"
    if not r.content:
        return None, None, "빈 응답"
    return r.content, mime, None

#!/usr/bin/env python3
"""
source_map.py — 게시물(shortcode) → 인스타 계정 원장 + "최근 카드 나온 계정" 우선순위.

posts 테이블엔 어느 계정 글인지가 없어서(source_url 만) 로컬 원장을 둔다.
  - 수집 때 생성된 draft 마다 add() (bd_ingest.process_records — BD·HikerAPI 공통)
  - 초기값은 BD 스냅샷(보관 ~40일) + 수동 큐 로그에서 --bootstrap
rank(): 최근 N일 posts 중 분류를 통과한 카드(pending/published/expired = 노이즈 삭제·draft 제외)를
        원장으로 계정에 매핑해 카드 수 내림차순 → 예비 수집기(HikerAPI)가 이 순서로 조회.

사용:
  python3 source_map.py --bootstrap            # BD 스냅샷·수동큐 로그로 원장 채우기(무과금)
  python3 source_map.py --rank 60              # 최근 60일 카드 계정 순위 상위 출력
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

import requests

HERE = Path(__file__).parent
FILE = HERE / ".source-map.json"
VALID = ("pending", "published", "expired")   # 분류 통과(노이즈는 하드 DELETE 라 행이 없음)
_CODE = re.compile(r"instagram\.com/(?:[^/?#]+/)?(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)")


def shortcode(url: str) -> str | None:
    m = _CODE.search(url or "")
    return m.group(1) if m else None


def load() -> dict:
    try:
        return json.loads(FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def save(m: dict) -> None:
    tmp = FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(FILE)


def add(url: str, username: str | None, date: str | None = None, m: dict | None = None) -> bool:
    """원장에 한 건. m 을 넘기면 메모리에만(일괄 후 save), 안 넘기면 즉시 저장."""
    code, u = shortcode(url), (username or "").strip().lstrip("@").lower()
    if not code or not u:
        return False
    target = m if m is not None else load()
    target[code] = {"u": u, "d": (date or "")[:10]}
    if m is None:
        save(target)
    return True


def _supa() -> tuple[str, dict] | None:
    p = HERE / ".env.storage"
    if not p.exists():
        return None
    env = {}
    for ln in p.read_text(encoding="utf-8").splitlines():
        if "=" in ln and not ln.lstrip().startswith("#"):
            k, v = ln.split("=", 1); env[k.strip()] = v.strip().strip("\"'")
    url, key = env.get("SUPABASE_URL"), env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    return url.rstrip("/"), {"apikey": key, "Authorization": f"Bearer {key}"}


def valid_codes(days: int) -> set[str] | None:
    """최근 days 일 생성된 카드 중 분류 통과(VALID)한 것의 shortcode. 조회 불가면 None."""
    s = _supa()
    if not s:
        return None
    url, h = s
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    codes: set[str] = set()
    for off in range(0, 200_000, 1000):   # PostgREST max-rows 1000 → 페이지 반복
        try:
            r = requests.get(f"{url}/rest/v1/posts", headers={**h, "Range": f"{off}-{off + 999}"},
                             params={"select": "source_url", "created_at": f"gte.{since}",
                                     "status": f"in.({','.join(VALID)})", "order": "created_at.asc"},
                             timeout=60)
        except requests.RequestException as e:
            print(f"   ⚠ 카드 조회 오류: {e}"); return None
        if r.status_code not in (200, 206):
            print(f"   ⚠ 카드 조회 HTTP {r.status_code}"); return None
        rows = r.json()
        codes |= {c for c in (shortcode(x.get("source_url") or "") for x in rows) if c}
        if len(rows) < 1000:
            break
    return codes


def rank(days: int = 60) -> list[tuple[str, int, str]]:
    """[(username, 카드 수, 마지막 게시일)] 카드 수 내림차순. 원장·DB 없으면 []."""
    m, codes = load(), valid_codes(days)
    if not m or codes is None:
        return []
    agg: dict[str, list] = {}
    for code in codes:
        e = m.get(code)
        if not e:
            continue
        a = agg.setdefault(e["u"], [0, ""])
        a[0] += 1; a[1] = max(a[1], e.get("d") or "")
    return sorted(((u, n, d) for u, (n, d) in agg.items()), key=lambda t: (t[1], t[2]), reverse=True)


def bootstrap() -> int:
    """BD 새벽 스냅샷(보관분) + 수동 큐 로그 → 원장. 스냅샷 다운로드는 무과금."""
    import bd_client
    m = load(); before = len(m)
    sids, d = [], None
    for ln in (HERE / "bd-run-log.txt").open(encoding="utf-8", errors="replace"):
        g = re.match(r"===== (\d{4}-\d\d-\d\d) \d\d:\d\d:\d\d 수집", ln)
        if g:
            d = g.group(1)
        g = re.search(r"snapshot_id=(sd_[a-z0-9]+)", ln)
        if g:
            sids.append((d, g.group(1)))
    got = gone = 0
    for d, sid in sids[-60:]:
        recs, err = bd_client.fetch_snapshot(sid, retries=2, wait=5, log=lambda *_: None)
        if err:
            gone += 1; continue
        got += 1
        for r in recs:
            if r.get("url"):
                add(r["url"], r.get("user_posted"), r.get("date_posted"), m)
    # 수동 큐: "- https://www.instagram.com/p/XXX/ @user Carousel date=2026-..." (bd-queue-log, bd-urls-*.log)
    pat = re.compile(r"^- (https://www\.instagram\.com/\S+) @(\S+) .*?date=(\S+)")
    for f in [HERE / "bd-queue-log.txt", *sorted(HERE.glob("bd-urls-*.log"))]:
        if f.exists():
            for ln in f.open(encoding="utf-8", errors="replace"):
                g = pat.match(ln)
                if g:
                    add(g.group(1), g.group(2), g.group(3), m)
    save(m)
    print(f"원장 {before} → {len(m)}건 (스냅샷 {got}개 반영, 만료 {gone}개)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="게시물→계정 원장 / 최근 카드 계정 순위")
    ap.add_argument("--bootstrap", action="store_true", help="BD 스냅샷·수동큐 로그로 원장 채우기")
    ap.add_argument("--rank", type=int, default=0, metavar="DAYS", help="최근 DAYS일 카드 계정 순위 출력")
    a = ap.parse_args()
    if a.bootstrap:
        return bootstrap()
    if a.rank:
        r = rank(a.rank)
        print(f"최근 {a.rank}일 카드 낸 계정 {len(r)}개 (원장 {len(load())}건)")
        for u, n, d in r[:30]:
            print(f"  {n:3d}  @{u}  (마지막 {d})")
        return 0
    ap.print_help(); return 0


if __name__ == "__main__":
    sys.exit(main())

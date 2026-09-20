#!/usr/bin/env python3
"""bd_urls.py — 수동 큐(ingest_queue todo)의 게시물 URL을 BD로 직접 수집 → draft 카드 → 큐 done/failed.

두 가지 사용:
  python3 bd_urls.py <url> [<url>...]           # URL 직접 지정 (큐 id는 shortcode로 서버에서 매핑)
  python3 bd_urls.py --from-queue [--limit 40]  # 큐 todo 전부(상한) 자동 처리 — bd-queue.sh(launchd 1시간)가 호출

BD는 계정 스캔(discover)이 아니라 게시물 URL 그대로 수집 → 넣은 건수만 과금.
결과 draft는 bd_classify.py(로컬 헤드리스 Claude)가 분류 → pending. 마지막 줄
`CREATED_IDS=<id,id,...>` 는 bd-queue.sh 가 그 회차 draft만 분류하도록 넘기는 용도.
"""
from __future__ import annotations

import argparse
import io
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
from PIL import Image

import bd_client
import bd_ingest
import ingest
from bd_notify import alert

# 인스타 게시물 shortcode — /p/ /reel/ /reels/ /tv/ (앞에 /username/ 이 끼는 형식도 허용).
# BD가 돌려주는 url 은 입력과 형식이 다를 수 있어(reel↔p, 끝 슬래시) shortcode 로 큐를 매핑한다.
SHORTCODE_RE = re.compile(r"instagram\.com/(?:[^/?#]+/)?(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)", re.I)


def shortcode(url: str | None) -> str | None:
    m = SHORTCODE_RE.search(url or "")
    return m.group(1) if m else None


def compress(b: bytes, mime: str):
    try:
        im = Image.open(io.BytesIO(b)).convert("RGB"); im.thumbnail((1080, 1080))
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=82, optimize=True)
        return (buf.getvalue(), "image/jpeg") if len(buf.getvalue()) < len(b) else (b, mime)
    except Exception:
        return b, mime


def main() -> int:
    ap = argparse.ArgumentParser(description="수동 큐 URL → BD 직접 수집 → draft 카드")
    ap.add_argument("urls", nargs="*", help="게시물 URL (없으면 --from-queue)")
    ap.add_argument("--from-queue", action="store_true", help="큐 todo 항목을 서버에서 가져와 처리")
    ap.add_argument("--limit", type=int, default=40, help="--from-queue 한 회차 상한 (BD 과금 상한)")
    args = ap.parse_args()

    if not bd_client.configured():
        print("❌ .env BRIGHTDATA_API_TOKEN 미설정"); return 1
    if not ingest.API_TOKEN:
        print("❌ .env ADMIN_CLI_TOKEN 미설정"); return 1

    # ---- 0) 대상 URL + 큐 id 매핑 (shortcode 기준) ----
    todo = ingest.fetch_export_todo_via_api() or {}
    todo_items = [t for t in todo.get("items", []) if t.get("url") and t.get("queue_id")]
    qid_by_code: dict[str, str] = {}
    for t in todo_items:
        c = shortcode(t["url"])
        if c:
            qid_by_code.setdefault(c, t["queue_id"])

    if args.from_queue:
        urls: list[str] = []
        for t in todo_items:
            if shortcode(t["url"]):
                urls.append(t["url"])
            else:
                # 프로필·블로그 등 게시물이 아닌 URL 은 BD 로 못 긁음 → 실패 처리(웹 큐에 사유 표시, 무한 재시도 방지)
                ingest.report_complete(t["queue_id"], "failed",
                                       error="인스타 게시물 URL(/p/·/reel/)이 아니라 자동 수집 불가")
                print(f"- 실패(게시물 URL 아님): {t['url']}")
        if not urls:
            print("QUEUE_EMPTY"); print("큐 todo 0건 — 할 일 없음"); return 0
        if len(urls) > args.limit:
            print(f"큐 todo {len(urls)}건 중 {args.limit}건만 이번 회차 처리 (나머지는 다음 회차)")
            urls = urls[:args.limit]
    else:
        urls = [u.strip() for u in args.urls if u.strip()]
        if not urls:
            print("url 필요 (또는 --from-queue)"); return 1

    # 같은 게시물 중복 입력 제거 (shortcode 기준)
    seen: set[str] = set(); uniq: list[str] = []
    for u in urls:
        c = shortcode(u) or u
        if c in seen: continue
        seen.add(c); uniq.append(u)
    urls = uniq
    requested = {shortcode(u) or u: u for u in urls}
    print(f"📡 수동 큐 수집: {len(urls)}건 (BD 게시물 URL 직접 수집)")

    # ---- 1) BD 직접 수집 (discover 아님 — 게시물 URL 그대로) ----
    try:
        r = requests.post(f"{bd_client.BASE}/trigger", headers={**bd_client._auth(), "Content-Type": "application/json"},
                          params={"dataset_id": bd_client.DATASET_ID, "include_errors": "true"},
                          json={"input": [{"url": u} for u in urls]}, timeout=60)
    except requests.RequestException as e:
        print(f"❌ trigger 네트워크 오류: {e}")
        alert("엄빠레이더 수동 큐 수집 실패", [f"BD trigger 네트워크 오류: {e}", f"큐 todo {len(urls)}건 그대로 대기 (다음 회차 재시도)"])
        return 1
    print("trigger", r.status_code, r.text[:200])
    sid = (r.json() if r.status_code == 200 else {}).get("snapshot_id")
    if not sid:
        alert("엄빠레이더 수동 큐 수집 실패", [f"BD trigger HTTP {r.status_code}: {r.text[:200]}",
                                       f"큐 todo {len(urls)}건 그대로 대기 (다음 회차 재시도)"])
        return 1
    ok, prog = bd_client.wait_ready(sid)
    print("progress", prog)
    if not ok:
        alert("엄빠레이더 수동 큐 수집 실패", [f"스냅샷 {sid} 상태: {prog}", f"큐 todo {len(urls)}건 그대로 대기 (다음 회차 재시도)"])
        return 1
    recs, err = bd_client.fetch_snapshot(sid)
    if err:
        print(f"❌ {err}")
        alert("엄빠레이더 수동 큐 수집 실패", [f"스냅샷 {sid}: {err}", f"큐 todo {len(urls)}건 그대로 대기 (다음 회차 재시도)"])
        return 1
    print(f"records {len(recs)}")

    # ---- 2) draft 카드 생성 + 큐 완료 보고 ----
    created_ids: list[str] = []
    handled: set[str] = set()   # 처리(성공·실패 보고)된 shortcode
    n_created = n_dup = n_failed = 0

    def fail(code: str | None, url: str, reason: str):
        nonlocal n_failed
        n_failed += 1
        if code: handled.add(code)
        q = qid_by_code.get(code or "")
        if q: ingest.report_complete(q, "failed", error=reason)
        print(f"  ❌ 실패: {reason}  {url}")

    for rec in recs:
        rec_url = rec.get("url") or ((rec.get("input") or {}).get("url") if isinstance(rec.get("input"), dict) else None)
        code = shortcode(rec_url)
        # include_errors=true → 비공개·삭제 게시물은 error 레코드로 옴 (무과금)
        if rec.get("error") and not rec.get("description"):
            fail(code, rec_url or "?", f"BD 오류: {str(rec.get('error'))[:200]} (비공개·삭제 게시물 가능)")
            continue
        m = bd_client.map_record(rec)
        if not m:
            print("skip rec (no url)", str(rec)[:200]); continue
        code = shortcode(m["url"]) or code
        print(f"- {m['url']} @{m['source_username']} {m['content_type']} date={m['source_post_date']}")
        print(f"  caption: {(m['caption_preview'] or '')[:120]!r}")
        img, mime = b"", "image/jpeg"
        if m["image_url"]:
            img, mime, e = bd_client.fetch_cdn_image(m["image_url"])
            if e: print("  image fail", e); img = b""
        if not img:
            fail(code, m["url"], "대표 이미지 없음/다운 실패 (서버는 이미지 필수)"); continue
        img, mime = compress(img, mime); print(f"  image {len(img)//1024}KB {mime}")
        res = bd_ingest.upload_bytes(m["url"], m["caption_preview"] or "", img, mime, raw=True,
                                     source_post_date=m["source_post_date"])
        print("  upload:", {k: res.get(k) for k in ("ok", "error", "post_id", "duplicate", "status")})
        if not res.get("ok"):
            fail(code, m["url"], f"카드 생성 실패: {str(res.get('error'))[:200]}"); continue
        if code: handled.add(code)
        is_dup = res.get("status") == "duplicate" or bool(res.get("duplicate"))
        q = qid_by_code.get(code or "")
        if is_dup:
            n_dup += 1
            if q: ingest.report_complete(q, "duplicate", post_id=res.get("post_id")); print(f"  queue → {q[:8]} duplicate")
        else:
            n_created += 1
            if res.get("post_id"): created_ids.append(res["post_id"])
            if q: ingest.report_complete(q, "done", post_id=res.get("post_id")); print(f"  queue → {q[:8]} done")

    # ---- 3) 결과에 안 나온 URL — BD 가 아예 못 찾은 게시물 ----
    missing = [u for c, u in requested.items() if c not in handled]
    if missing:
        if not recs and not (prog.get("errors") or 0):
            # 레코드도 오류도 0 = BD 쪽 일시 장애로 보고 큐는 건드리지 않음(다음 회차 재시도)
            print(f"⚠ 결과 0건·오류 0건 — 일시 장애로 보고 {len(missing)}건 todo 유지")
            alert("엄빠레이더 수동 큐 수집 결과 없음", [f"스냅샷 {sid}: 레코드 0·오류 0", f"{len(missing)}건 todo 유지 → 다음 회차 재시도"])
        else:
            for u in missing:
                fail(shortcode(u), u, "BD 결과 없음 (비공개·삭제·잘못된 URL 가능) — 재시도 버튼으로 다시 시도 가능")

    print(f"\n✅ 수동 큐 수집 완료 — draft 생성 {n_created} / 중복 {n_dup} / 실패 {n_failed}")
    print(f"CREATED_IDS={','.join(created_ids)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

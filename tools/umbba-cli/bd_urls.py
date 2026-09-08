#!/usr/bin/env python3
"""bd_urls.py — 수동 큐(ingest_queue todo)의 특정 게시물 URL을 BD로 직접 수집 → draft 카드 → 큐 done.
사용: python3 bd_urls.py <url> [<url>...]   (큐 id는 url로 서버에서 매핑)
"""
import sys, io, time, requests, base64
import bd_client, ingest, bd_ingest
from PIL import Image

def compress(b: bytes, mime: str):
    try:
        im = Image.open(io.BytesIO(b)).convert("RGB"); im.thumbnail((1080, 1080))
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=82, optimize=True)
        return (buf.getvalue(), "image/jpeg") if len(buf.getvalue()) < len(b) else (b, mime)
    except Exception:
        return b, mime

urls = [u.strip() for u in sys.argv[1:] if u.strip()]
if not urls: sys.exit("url 필요")
# 1) BD 직접 수집 (discover 아님 — 게시물 URL 그대로)
r = requests.post(f"{bd_client.BASE}/trigger", headers={**bd_client._auth(), "Content-Type": "application/json"},
                  params={"dataset_id": bd_client.DATASET_ID, "include_errors": "true"},
                  json={"input": [{"url": u} for u in urls]}, timeout=60)
print("trigger", r.status_code, r.text[:200])
sid = r.json().get("snapshot_id")
ok, prog = bd_client.wait_ready(sid)
print("progress", prog)
recs, err = bd_client.fetch_snapshot(sid)
if err: sys.exit(err)
print(f"records {len(recs)}")
# 2) 큐 id 매핑
todo = ingest.fetch_export_todo_via_api() or {}
qid = {t["url"].rstrip("/"): t["queue_id"] for t in todo.get("items", []) if t.get("url")}
# 3) draft 카드 생성
for rec in recs:
    m = bd_client.map_record(rec)
    if not m: print("skip rec (no url)", str(rec)[:200]); continue
    print(f"- {m['url']} @{m['source_username']} {m['content_type']} date={m['source_post_date']}")
    print(f"  caption: {(m['caption_preview'] or '')[:120]!r}")
    img, mime = b"", "image/jpeg"
    if m["image_url"]:
        img, mime, e = bd_client.fetch_cdn_image(m["image_url"])
        if e: print("  image fail", e); img = b""
    if img: img, mime = compress(img, mime); print(f"  image {len(img)//1024}KB {mime}")
    res = bd_ingest.upload_bytes(m["url"], m["caption_preview"] or "", img or b"", mime, raw=True,
                                 source_post_date=m["source_post_date"])
    print("  upload:", {k: res.get(k) for k in ("ok", "error", "post_id", "duplicate", "status")})
    q = qid.get(m["url"].rstrip("/"))
    if q and res.get("ok"):
        ingest.report_complete(q, "duplicate" if res.get("duplicate") else "done", post_id=res.get("post_id"))
        print("  queue →", q[:8], "done")

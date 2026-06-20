#!/usr/bin/env python3
"""
bd_local.py — 옵션 C: BD 수집 + 로컬 Claude 분류 (유료 Vision API 0, 쿠키 0).
설계: docs/DESIGN-OPTION-C-LOCAL-CLAUDE.md

단일 프로세스 흐름:
  1. BD discover 스캔 → posts(url, caption, date, image_url)        [밴/쿠키 0]
  2. 큐 적재 /api/admin/queue/add  (ingest.push_urls_to_queue)
  3. export-todo → queue_id 매핑   (ingest.fetch_export_todo_via_api)
  4. input.json → 헤드리스 Claude(구독 토큰) 분류 → results.json   [API 비용 0]
  5. keepers(skip=false) 이미지: image_url(CDN) fetch → upload-image → thumbnail_url
  6. import-results → pending 카드  [Vision 호출 0]

요구: 같은 폴더에 bd_client.py, ingest.py, RULES.md.
      claude(Claude Code) 설치 + CLAUDE_CODE_OAUTH_TOKEN(구독, `claude setup-token`).
      .env: BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN, UMBBA_API_URL.
사용:
  python3 bd_local.py --max-accounts 800 --scan-days 1
  python3 bd_local.py --accounts kahi_official --scan-days 14 --dry-run   # 분류까지만(큐/카드 X)
  python3 bd_local.py --snapshot <id>                                     # 기존 스냅샷 재처리
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
import bd_client
import ingest  # 재사용: push_urls_to_queue, fetch_export_todo_via_api, upload_image_to_storage, API_URL/API_TOKEN

DIR = Path(__file__).resolve().parent
RULES = DIR / "RULES.md"

# run-b.ps1 과 동일한 분류 프롬프트 (파일 기반, 셸/cd 금지)
CLASSIFY_PROMPT = """You are a classifier for the Korean parenting-deals service umbba-radar.
Work ONLY with files in your CURRENT folder. Do NOT run shell commands, do NOT cd,
do NOT use background tasks, do NOT ask questions.
Steps:
1. Read RULES.md (full ruleset) and input.json (items), both in the current folder.
2. Classify EVERY item in input.json.items exactly per RULES.md.
3. Write results.json in the current folder as UTF-8 JSON: an object {"items": [ ... ]}.
   Each result item MUST have these keys: queue_id (copy from input), skip (boolean),
   title, brand_name, body, search_keywords, kind ("recruiting" or "group_buy"), stage_categories (array), type_tags (array),
   topic, deadline (ISO8601 with +09:00, or null), confidence (number 0..1).
   Follow RULES.md for every value and all skip patterns. Use input.json today_kst
   for expiry checks. results count MUST equal input count; preserve every queue_id.
4. After results.json is written, reply with exactly: DONE
"""


def today_kst() -> str:
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y-%m-%d")


def find_claude() -> str | None:
    env = os.getenv("UMBBA_CLAUDE")
    if env and Path(env).exists():
        return env
    return shutil.which("claude")


# ============================================
# 4) 헤드리스 Claude 한 배치 분류
# ============================================
def classify_batch(claude_bin: str, items: list[dict], tkst: str, workdir: Path) -> tuple[list[dict] | None, str | None]:
    workdir.mkdir(parents=True, exist_ok=True)
    shutil.copy(RULES, workdir / "RULES.md")
    (workdir / "input.json").write_text(
        json.dumps({"today_kst": tkst, "count": len(items), "items": items}, ensure_ascii=False),
        encoding="utf-8",
    )
    try:
        proc = subprocess.run(
            [claude_bin, "-p", "--permission-mode", "bypassPermissions", "--model", "sonnet"],
            cwd=str(workdir), input=CLASSIFY_PROMPT,
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
        )
    except subprocess.TimeoutExpired:
        return None, "claude timeout(900s)"
    except Exception as e:
        return None, f"claude 실행 오류: {e}"
    res = workdir / "results.json"
    if not res.exists():
        err = (proc.stderr or proc.stdout or "")[:200]
        return None, f"results.json 없음 (exit {proc.returncode}): {err}"
    try:
        data = json.loads(res.read_text(encoding="utf-8"))
    except Exception as e:
        return None, f"results 파싱 실패: {e}"
    return (data.get("items") or []), None


def classify_all(items: list[dict], tkst: str, batch: int) -> list[dict]:
    claude_bin = find_claude()
    if not claude_bin:
        print("❌ claude 실행파일 못 찾음 — Claude Code 설치 + PATH 또는 UMBBA_CLAUDE 환경변수")
        return []
    print(f"   claude: {claude_bin}")
    out: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="umbba-bdlocal-") as tmp:
        nb = (len(items) + batch - 1) // batch
        for b in range(nb):
            chunk = items[b * batch:(b + 1) * batch]
            print(f"   분류 배치 {b+1}/{nb} ({len(chunk)}건)…")
            res, err = classify_batch(claude_bin, chunk, tkst, Path(tmp) / f"b{b}")
            if err:
                print(f"   ⚠ 배치 {b+1} 분류 실패: {err}")
                continue
            out.extend(res)
    return out


# ============================================
# 5) 이미지 업로드 (BD CDN → Storage)  /  6) import
# ============================================
def upload_bd_image(image_url: str) -> str | None:
    img, mime, err = bd_client.fetch_cdn_image(image_url)
    if not img:
        return None
    ext = {"image/png": ".png", "image/webp": ".webp"}.get(mime, ".jpg")
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(img)
        tmp_path = Path(f.name)
    try:
        return ingest.upload_image_to_storage(tmp_path)
    finally:
        try:
            tmp_path.unlink()
        except Exception:
            pass


def import_results(items: list[dict]) -> dict:
    """import-results 로 카드 생성 (200개 청크). 이미 thumbnail_url 채워져 gallery-dl 안 탐."""
    created = skipped = failed = 0
    for off in range(0, len(items), 200):
        chunk = items[off:off + 200]
        try:
            r = requests.post(
                f"{ingest.API_URL}/api/admin/queue/import-results",
                headers={"Authorization": f"Bearer {ingest.API_TOKEN}", "Content-Type": "application/json"},
                json={"items": chunk}, timeout=120,
            )
            d = r.json() if r.status_code == 200 else {}
        except requests.RequestException as e:
            print(f"   ❌ import 청크 네트워크 오류: {e}"); failed += len(chunk); continue
        if not d.get("ok"):
            print(f"   ❌ import 실패: HTTP {r.status_code} {str(d)[:150]}"); failed += len(chunk); continue
        created += d.get("created", 0); skipped += d.get("skipped", 0); failed += d.get("failed", 0)
    return {"created": created, "skipped": skipped, "failed": failed}


# ============================================
# 메인
# ============================================
def main() -> int:
    ap = argparse.ArgumentParser(description="옵션 C: BD 수집 + 로컬 Claude 분류")
    ap.add_argument("--max-accounts", type=int, default=800)
    ap.add_argument("--recent", type=int, default=3)
    ap.add_argument("--scan-days", type=int, default=1)
    ap.add_argument("--accounts", nargs="*", help="계정 직접 지정(테스트)")
    ap.add_argument("--snapshot", help="기존 스냅샷 id 재처리(재과금 X)")
    ap.add_argument("--batch", type=int, default=25, help="Claude 분류 배치 크기")
    ap.add_argument("--max-items", type=int, default=0, help="이번 회차 분류 상한(0=전체, 구독 한도 관리용)")
    ap.add_argument("--dry-run", action="store_true", help="분류까지만(큐 적재·이미지·카드 X)")
    args = ap.parse_args()

    if not bd_client.configured():
        print("❌ .env BRIGHTDATA_API_TOKEN 미설정"); return 1
    if not ingest.API_TOKEN:
        print("❌ .env ADMIN_CLI_TOKEN 미설정"); return 1
    if not RULES.exists():
        print(f"❌ RULES.md 없음: {RULES}"); return 1

    # ---- 1) BD 스캔 ----
    if args.snapshot:
        sid = args.snapshot
        print(f"🔁 기존 스냅샷 재처리: {sid}")
        prog = bd_client.progress(sid)
    else:
        usernames = ([u.strip().lstrip("@") for u in args.accounts if u.strip()]
                     if args.accounts else ingest.fetch_active_usernames())
        if not usernames:
            print("📡 활성 계정 0개"); return 0
        usernames = usernames[:args.max_accounts]
        start_date = ""
        if args.scan_days > 0:
            d = datetime.datetime.now() - datetime.timedelta(days=args.scan_days)
            start_date = d.strftime("%m-%d-%Y")
        print(f"🔭 BD 스캔: {len(usernames)}계정, recent {args.recent}, start_date {start_date or '(없음)'}"
              + ("  [DRY]" if args.dry_run else ""))
        sid, err = bd_client.trigger_discover(usernames, args.recent, start_date)
        if err:
            print(f"❌ {err}"); return 1
        print(f"   snapshot_id={sid}")
        ok, prog = bd_client.wait_ready(sid)
        if not ok:
            print(f"❌ 스냅샷 실패: {prog}"); return 1

    records, ferr = bd_client.fetch_snapshot(sid)
    if ferr:
        print(f"❌ {ferr}"); return 1
    print(f"📦 records(과금) {prog.get('records')} / errors {prog.get('errors')} / 수신 {len(records)}")

    posts = [m for m in (bd_client.map_record(r) for r in records) if m and m.get("url")]
    url_to_image = {p["url"]: p.get("image_url") for p in posts}
    if not posts:
        print("신규 글 0건 — 종료"); return 0

    tkst = today_kst()

    # ---- DRY: 큐 안 거치고 BD 글로 바로 분류 테스트 ----
    if args.dry_run:
        items = [{"queue_id": p["url"], "url": p["url"], "source_username": p.get("source_username"),
                  "source_post_date": p.get("source_post_date"), "caption_preview": p.get("caption_preview")}
                 for p in posts]
        if args.max_items > 0:
            items = items[:args.max_items]
        print(f"🧪 DRY 분류: {len(items)}건 (큐/카드 생성 X)")
        results = classify_all(items, tkst, args.batch)
        keep = [r for r in results if not r.get("skip")]
        print(f"\n✅ 분류 {len(results)}건 / 카드대상(keep) {len(keep)} / skip {len(results)-len(keep)}")
        for r in keep[:15]:
            print(f"   · {str(r.get('title'))[:40]}  (conf {r.get('confidence')})")
        return 0

    # ---- 2) 큐 적재 ----
    queue_items = [{"url": p["url"], "source_username": p.get("source_username"),
                    "source_post_date": p.get("source_post_date"), "caption_preview": p.get("caption_preview")}
                   for p in posts]
    push = ingest.push_urls_to_queue(queue_items)
    print(f"🗂️  큐 적재: 신규 {push.get('added', '?')}건 (총 {len(queue_items)} 시도)")

    # ---- 3) export-todo → queue_id 매핑 ----
    todo = ingest.fetch_export_todo_via_api()
    if not todo:
        print("❌ export-todo 실패"); return 1
    todo_items = todo.get("items", [])
    # 방금 BD로 넣은 url 만 대상으로 (다른 todo 섞이지 않게)
    our_urls = set(url_to_image.keys())
    todo_items = [t for t in todo_items if t.get("url") in our_urls]
    if args.max_items > 0:
        todo_items = todo_items[:args.max_items]
    if not todo_items:
        print("처리할 todo 0건 (이미 다 처리됐거나 신규 없음)"); return 0
    qid_to_url = {t["queue_id"]: t["url"] for t in todo_items if t.get("queue_id")}
    print(f"📋 분류 대상 {len(todo_items)}건")

    # ---- 4) 분류 ----
    results = classify_all(todo_items, todo.get("today_kst", tkst), args.batch)
    if not results:
        print("❌ 분류 결과 0건"); return 1

    # ---- 5) keepers 이미지 → thumbnail_url ----
    keep = [r for r in results if not r.get("skip")]
    print(f"🖼️  이미지 업로드: keepers {len(keep)}건 (skip 제외)")
    for r in keep:
        url = qid_to_url.get(r.get("queue_id"))
        img_url = url_to_image.get(url) if url else None
        if not img_url:
            continue
        thumb = upload_bd_image(img_url)
        if thumb:
            r["thumbnail_url"] = thumb

    # ---- 6) import ----
    summary = import_results(results)
    print(f"\n✅ 완료 — 생성 {summary['created']} / skip {summary['skipped']} / 실패 {summary['failed']}")
    print(f"   검수: {ingest.API_URL}/admin/queue")
    return 0


if __name__ == "__main__":
    sys.exit(main())

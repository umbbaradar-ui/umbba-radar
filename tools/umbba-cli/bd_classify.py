#!/usr/bin/env python3
"""
bd_classify.py — 분류 루틴 (옵션 C): DB 미분류(draft) 카드 → 로컬 Claude → 확정/삭제.
유료 Vision API 0 (분류=구독 정액). 설계: docs/COLLECTION-DIRECTION-FINAL-2026-06-21.md

흐름(배치마다 즉시 저장 — 중간에 끊겨도 그때까지는 보존):
  1. GET /api/admin/cards/drafts        → 미분류 카드 [{id, source_url, body}]
  2. 배치(기본 6)마다: 로컬 헤드리스 Claude(구독) 분류 → 곧바로
  3. POST /api/admin/cards/classify     → draft→pending UPDATE / 노이즈 DELETE

요구: 같은 폴더 bd_local.py(claude 호출부), ingest.py, RULES.md.
      claude(Claude Code) + CLAUDE_CODE_OAUTH_TOKEN(`claude setup-token`).
사용:
  python3 bd_classify.py --limit 320 --batch 6
  python3 bd_classify.py --limit 10 --dry-run     # 분류만, 확정/삭제 안 함
"""
from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
import ingest
from bd_local import classify_batch, find_classifier, today_kst  # 분류 호출부 재사용(claude/codex)


def fetch_drafts(limit: int) -> list[dict]:
    try:
        r = requests.get(
            f"{ingest.API_URL}/api/admin/cards/drafts?limit={limit}",
            headers={"Authorization": f"Bearer {ingest.API_TOKEN}"}, timeout=60,
        )
    except requests.RequestException as e:
        print(f"❌ drafts fetch 네트워크 오류: {e}"); return []
    if r.status_code != 200:
        print(f"❌ drafts HTTP {r.status_code}: {r.text[:200]}"); return []
    return r.json().get("items", [])


def post_classify(items: list[dict]) -> dict:
    """한 배치 결과를 /cards/classify POST. 반환 합계."""
    updated = deleted = failed = 0
    for off in range(0, len(items), 200):
        chunk = items[off:off + 200]
        try:
            r = requests.post(
                f"{ingest.API_URL}/api/admin/cards/classify",
                headers={"Authorization": f"Bearer {ingest.API_TOKEN}", "Content-Type": "application/json"},
                json={"items": chunk}, timeout=120,
            )
            d = r.json() if r.status_code == 200 else {}
        except requests.RequestException as e:
            print(f"   ❌ classify 네트워크 오류: {e}"); failed += len(chunk); continue
        if not d.get("ok"):
            print(f"   ❌ classify 실패 HTTP {r.status_code}: {str(d)[:150]}"); failed += len(chunk); continue
        updated += d.get("updated", 0); deleted += d.get("deleted", 0); failed += d.get("failed", 0)
    return {"updated": updated, "deleted": deleted, "failed": failed}


def to_classify_item(r: dict) -> dict:
    return {
        "id": r.get("queue_id"), "skip": bool(r.get("skip")),
        "title": r.get("title"), "brand_name": r.get("brand_name"), "body": r.get("body"),
        "search_keywords": r.get("search_keywords"), "kind": r.get("kind"),
        "stage_categories": r.get("stage_categories"), "type_tags": r.get("type_tags"),
        "item_categories": r.get("item_categories"),
        "topic": r.get("topic"), "deadline": r.get("deadline"),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="옵션 C 분류 루틴: 미분류 draft → 로컬 Claude → 확정/삭제")
    ap.add_argument("--limit", type=int, default=200, help="한 회차 draft fetch 상한")
    ap.add_argument("--batch", type=int, default=6, help="Claude 배치 크기(작게=빠르고 안전)")
    ap.add_argument("--dry-run", action="store_true", help="분류만, 확정/삭제 안 함")
    args = ap.parse_args()

    if not ingest.API_TOKEN:
        print("❌ .env ADMIN_CLI_TOKEN 미설정"); return 1

    drafts = fetch_drafts(args.limit)
    if not drafts:
        print("미분류 카드 0건 — 할 일 없음"); return 0
    items = [{"queue_id": d["id"], "url": d.get("source_url"),
              "caption_preview": d.get("body")} for d in drafts if d.get("id")]
    print(f"📋 미분류(draft) {len(items)}건 분류 (배치 {args.batch}, 배치마다 즉시 저장)")

    claude_bin, backend = find_classifier()
    if not claude_bin:
        print(f"❌ {backend} 실행파일 못 찾음 — 설치 + PATH 또는 UMBBA_{backend.upper()} 환경변수"); return 1
    print(f"   {backend}: {claude_bin}")

    tkst = today_kst()
    tot = {"updated": 0, "deleted": 0, "failed": 0}
    nb = (len(items) + args.batch - 1) // args.batch
    with tempfile.TemporaryDirectory(prefix="umbba-bdcls-") as tmp:
        for b in range(nb):
            chunk = items[b * args.batch:(b + 1) * args.batch]
            print(f"   배치 {b+1}/{nb} ({len(chunk)}건) 분류…", flush=True)
            res, err = classify_batch(claude_bin, chunk, tkst, Path(tmp) / f"b{b}")
            if err:
                print(f"   ⚠ 배치 {b+1} 실패: {err} — 건너뜀(다음 실행때 재시도)")
                continue
            if args.dry_run:
                keep = [r for r in res if not r.get("skip")]
                print(f"   [DRY] 배치 {b+1}: 확정대상 {len(keep)} / 노이즈 {len(res)-len(keep)}")
                continue
            out = [to_classify_item(r) for r in res if r.get("queue_id")]
            s = post_classify(out)
            tot["updated"] += s["updated"]; tot["deleted"] += s["deleted"]; tot["failed"] += s["failed"]
            print(f"   ✅ 배치 {b+1}: 확정 {s['updated']} / 삭제 {s['deleted']} / 실패 {s['failed']}"
                  f"  (누적 확정 {tot['updated']})", flush=True)

    print(f"\n✅ 완료 — 확정(pending) {tot['updated']} / 삭제 {tot['deleted']} / 실패 {tot['failed']}")
    print(f"   검수: {ingest.API_URL}/admin/queue")
    return 0


if __name__ == "__main__":
    sys.exit(main())

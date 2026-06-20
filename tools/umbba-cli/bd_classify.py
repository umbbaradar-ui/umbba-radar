#!/usr/bin/env python3
"""
bd_classify.py — 분류 루틴 (옵션 C): DB 미분류(draft) 카드 → 로컬 Claude → 확정/삭제.
유료 Vision API 0 (분류=구독 정액). 설계: docs/COLLECTION-DIRECTION-FINAL-2026-06-21.md

흐름:
  1. GET /api/admin/cards/drafts        → 미분류 카드 [{id, source_url, body, thumbnail_url}]
  2. 로컬 헤드리스 Claude(구독 토큰) 분류 → [{queue_id(=id), skip, title, deadline, ...}]
  3. POST /api/admin/cards/classify     → draft→pending UPDATE / 노이즈 DELETE

요구: 같은 폴더 bd_local.py(claude 호출부), ingest.py, RULES.md.
      claude(Claude Code) + CLAUDE_CODE_OAUTH_TOKEN(`claude setup-token`).
사용:
  python3 bd_classify.py --limit 200 --batch 25
  python3 bd_classify.py --limit 10 --dry-run     # 분류만, 확정/삭제 안 함
"""
from __future__ import annotations

import argparse
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
import ingest
from bd_local import classify_all, today_kst  # claude 호출부 재사용


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
    """200개 청크로 /cards/classify POST. 반환 합계."""
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
            print(f"   ❌ classify 청크 네트워크 오류: {e}"); failed += len(chunk); continue
        if not d.get("ok"):
            print(f"   ❌ classify 실패 HTTP {r.status_code}: {str(d)[:150]}"); failed += len(chunk); continue
        updated += d.get("updated", 0); deleted += d.get("deleted", 0); failed += d.get("failed", 0)
    return {"updated": updated, "deleted": deleted, "failed": failed}


def main() -> int:
    ap = argparse.ArgumentParser(description="옵션 C 분류 루틴: 미분류 draft → 로컬 Claude → 확정/삭제")
    ap.add_argument("--limit", type=int, default=200, help="한 회차 분류 상한(draft fetch + 구독 한도 관리)")
    ap.add_argument("--batch", type=int, default=25, help="Claude 배치 크기")
    ap.add_argument("--dry-run", action="store_true", help="분류만, 확정/삭제 안 함")
    args = ap.parse_args()

    if not ingest.API_TOKEN:
        print("❌ .env ADMIN_CLI_TOKEN 미설정"); return 1

    drafts = fetch_drafts(args.limit)
    if not drafts:
        print("미분류 카드 0건 — 할 일 없음"); return 0
    print(f"📋 미분류(draft) {len(drafts)}건 분류 시작")

    # 입력: queue_id = post id (RULES/프롬프트 포맷 그대로 재사용), 캡션 = body
    items = [{"queue_id": d["id"], "url": d.get("source_url"),
              "caption_preview": d.get("body")} for d in drafts if d.get("id")]

    results = classify_all(items, today_kst(), args.batch)
    if not results:
        print("❌ 분류 결과 0건 (claude 미설정/실패 가능)"); return 1

    keep = [r for r in results if not r.get("skip")]
    print(f"✅ 분류 {len(results)}건 / 확정대상 {len(keep)} / 노이즈(삭제) {len(results)-len(keep)}")

    if args.dry_run:
        for r in keep[:15]:
            print(f"   · {str(r.get('title'))[:42]}  (conf {r.get('confidence')})")
        print("   [DRY] 확정/삭제 안 함")
        return 0

    # 결과 → classify 엔드포인트 형식 (id = queue_id)
    out = [{
        "id": r.get("queue_id"), "skip": bool(r.get("skip")),
        "title": r.get("title"), "brand_name": r.get("brand_name"), "body": r.get("body"),
        "search_keywords": r.get("search_keywords"), "kind": r.get("kind"),
        "stage_categories": r.get("stage_categories"), "type_tags": r.get("type_tags"),
        "topic": r.get("topic"), "deadline": r.get("deadline"),
    } for r in results if r.get("queue_id")]

    summary = post_classify(out)
    print(f"\n✅ 완료 — 확정(pending) {summary['updated']} / 삭제 {summary['deleted']} / 실패 {summary['failed']}")
    print(f"   검수: {ingest.API_URL}/admin/queue")
    return 0


if __name__ == "__main__":
    sys.exit(main())

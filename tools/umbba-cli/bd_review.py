#!/usr/bin/env python3
"""
bd_review.py — 2차 검수 루틴: pending 카드 → 로컬 Claude(REVIEW-RULES.md) → 점수/판정/보정 기록.
비용 0 (구독 정액). 1차 분류(bd_classify.py) 다음 단계로 bd-run.sh 가 매일 실행.

흐름(배치마다 즉시 저장 — 중간에 끊겨도 그때까지는 보존):
  1. GET /api/admin/cards/review-queue     → 미검수 pending 카드(+중복 후보, today_kst)
  2. GET /api/admin/cards/review-feedback  → 사람-AI 어긋난 최근 사례(캘리브레이션, best-effort)
  3. 배치(기본 8)마다: 로컬 헤드리스 Claude 검수 → 곧바로
  4. POST /api/admin/cards/review-results  → ai_review_*(점수·판정·사유) + 택소노미 보정 저장

이후: pass & 고점수(기본 85+)는 매일 09:00 KST 서버 cron 이 자동 발행. warn/fail/미검수만 사람 검수.

요구: 같은 폴더 bd_local.py, ingest.py, REVIEW-RULES.md.
      claude(Claude Code) + CLAUDE_CODE_OAUTH_TOKEN(`claude setup-token`).
사용:
  python3 bd_review.py --limit 150 --batch 8
  python3 bd_review.py --limit 10 --dry-run          # 검수만, 저장 안 함
  python3 bd_review.py --enrich-published --limit 60 # 발행 카드 품목/키워드 백필(보정) 모드
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
import ingest
import bd_local  # 재사용: find_classifier, today_kst, _salvage_result_items, CLASSIFIER

DIR = Path(__file__).resolve().parent
REVIEW_RULES = DIR / "REVIEW-RULES.md"

# 분류 프롬프트(bd_local.CLASSIFY_PROMPT)와 동일한 파일 기반 계약 — 셸/cd 금지
REVIEW_PROMPT = """You are the second-stage QA reviewer for the Korean parenting-deals service umbba-radar.
Work ONLY with files in your CURRENT folder. Do NOT run shell commands, do NOT cd,
do NOT use background tasks, do NOT ask questions.
Steps:
1. Read REVIEW-RULES.md (ruleset) and input.json (cards + calibration), both in the current folder.
2. Review EVERY card in input.json.items exactly per REVIEW-RULES.md. You VERIFY existing
   cards against their original caption (body); you never invent or rewrite content.
3. Write results.json in the current folder as UTF-8 JSON: an object {"items": [ ... ]}.
   Each result item MUST have: id (copy from input), score (integer 0..100),
   review_status ("pass" | "warn" | "fail"), note (short Korean string),
   fixes (object with ONLY the keys you correct, among: search_keywords, item_categories,
   stage_categories, type_tags, brand_name; empty object if nothing to fix).
   Use input.json today_kst for expiry checks. results count MUST equal input count;
   preserve every id.
4. After results.json is written, reply with exactly: DONE
"""

FIX_KEYS = {"search_keywords", "item_categories", "stage_categories", "type_tags", "brand_name"}


def fetch_review_queue(limit: int, scope: str) -> tuple[list[dict], str]:
    """(items, today_kst) 반환. 실패 시 ([], today)."""
    try:
        r = requests.get(
            f"{ingest.API_URL}/api/admin/cards/review-queue?limit={limit}&scope={scope}",
            headers={"Authorization": f"Bearer {ingest.API_TOKEN}"}, timeout=60,
        )
    except requests.RequestException as e:
        print(f"❌ review-queue fetch 네트워크 오류: {e}"); return [], bd_local.today_kst()
    if r.status_code != 200:
        print(f"❌ review-queue HTTP {r.status_code}: {r.text[:200]}"); return [], bd_local.today_kst()
    d = r.json()
    return d.get("items", []), d.get("today_kst") or bd_local.today_kst()


def fetch_calibration() -> list[dict]:
    """사람-AI 어긋난 최근 사례 (best-effort — 실패해도 검수는 진행)."""
    try:
        r = requests.get(
            f"{ingest.API_URL}/api/admin/cards/review-feedback?limit=15",
            headers={"Authorization": f"Bearer {ingest.API_TOKEN}"}, timeout=30,
        )
        if r.status_code == 200:
            rows = r.json().get("disagreements", []) or []
            # 프롬프트에 필요한 필드만 (토큰 절약)
            return [
                {k: row.get(k) for k in
                 ("title", "brand_name", "ai_review_score", "ai_review_status", "ai_review_note", "human_action")}
                for row in rows[:12]
            ]
    except requests.RequestException:
        pass
    return []


def review_batch(bin_path: str, items: list[dict], tkst: str,
                 calibration: list[dict], workdir: Path) -> tuple[list[dict] | None, str | None]:
    workdir.mkdir(parents=True, exist_ok=True)
    shutil.copy(REVIEW_RULES, workdir / "REVIEW-RULES.md")
    (workdir / "input.json").write_text(
        json.dumps({"today_kst": tkst, "calibration": calibration,
                    "count": len(items), "items": items}, ensure_ascii=False),
        encoding="utf-8",
    )
    if bd_local.CLASSIFIER == "codex":
        cmd = [bin_path, "exec", "-C", str(workdir), "-s", "workspace-write",
               "--skip-git-repo-check", REVIEW_PROMPT]
        stdin_text, timeout_s = None, 300
    else:
        cmd = [bin_path, "-p", "--permission-mode", "bypassPermissions", "--model", "sonnet"]
        stdin_text, timeout_s = REVIEW_PROMPT, 240
    try:
        proc = subprocess.run(
            cmd, cwd=str(workdir), input=stdin_text,
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        return None, f"{bd_local.CLASSIFIER} timeout({timeout_s}s) — 막힌 배치, 건너뜀(다음 run 재시도)"
    except Exception as e:
        return None, f"{bd_local.CLASSIFIER} 실행 오류: {e}"
    res = workdir / "results.json"
    if not res.exists():
        err = (proc.stderr or proc.stdout or "")[:200]
        return None, f"results.json 없음 (exit {proc.returncode}): {err}"
    raw = res.read_text(encoding="utf-8")
    try:
        return (json.loads(raw).get("items") or []), None
    except Exception as e:
        salvaged = bd_local._salvage_result_items(raw)
        if salvaged:
            return salvaged, None
        return None, f"results 파싱 실패: {e}"


def to_result_item(r: dict, valid_ids: set[str]) -> dict | None:
    """모델 출력 → review-results API 형식. id 불일치/점수 없음이면 None."""
    rid = r.get("id")
    if not rid or rid not in valid_ids:
        return None
    try:
        score = int(round(float(r.get("score"))))
    except (TypeError, ValueError):
        return None
    score = max(0, min(100, score))
    status = r.get("review_status")
    if status not in ("pass", "warn", "fail"):
        status = None  # 서버가 점수로 유도
    fixes_raw = r.get("fixes")
    fixes = {k: v for k, v in fixes_raw.items() if k in FIX_KEYS} if isinstance(fixes_raw, dict) else {}
    out: dict = {"id": rid, "score": score, "note": (r.get("note") or "")[:300], "fixes": fixes}
    if status:
        out["review_status"] = status
    return out


def post_results(items: list[dict]) -> dict:
    updated = failed = fixes = 0
    for off in range(0, len(items), 200):
        chunk = items[off:off + 200]
        try:
            r = requests.post(
                f"{ingest.API_URL}/api/admin/cards/review-results",
                headers={"Authorization": f"Bearer {ingest.API_TOKEN}", "Content-Type": "application/json"},
                json={"items": chunk}, timeout=120,
            )
            d = r.json() if r.status_code == 200 else {}
        except requests.RequestException as e:
            print(f"   ❌ review-results 네트워크 오류: {e}"); failed += len(chunk); continue
        if not d.get("ok"):
            print(f"   ❌ review-results 실패 HTTP {r.status_code}: {str(d)[:200]}"); failed += len(chunk); continue
        updated += d.get("updated", 0); failed += d.get("failed", 0); fixes += d.get("fixes_applied", 0)
    return {"updated": updated, "failed": failed, "fixes": fixes}


def main() -> int:
    ap = argparse.ArgumentParser(description="2차 검수 루틴: pending → 로컬 Claude 검수 → 점수/판정/보정")
    ap.add_argument("--limit", type=int, default=150, help="한 회차 검수 대상 상한")
    ap.add_argument("--batch", type=int, default=8, help="Claude 배치 크기")
    ap.add_argument("--dry-run", action="store_true", help="검수만, 저장 안 함")
    ap.add_argument("--enrich-published", action="store_true",
                    help="발행 카드 백필 모드 — 품목 비어있는 published 카드의 품목/키워드 보정")
    args = ap.parse_args()

    if not ingest.API_TOKEN:
        print("❌ .env ADMIN_CLI_TOKEN 미설정"); return 1
    if not REVIEW_RULES.exists():
        print("❌ REVIEW-RULES.md 없음 — git pull 필요"); return 1

    scope = "enrich" if args.enrich_published else "pending"
    cards, tkst = fetch_review_queue(args.limit, scope)
    if not cards:
        print(f"검수 대상({scope}) 0건 — 할 일 없음"); return 0

    bin_path, backend = bd_local.find_classifier()
    if not bin_path:
        print(f"❌ {backend} 실행파일 못 찾음 — 설치 + PATH 또는 UMBBA_{backend.upper()} 환경변수"); return 1
    print(f"🧐 검수({scope}) {len(cards)}건 (배치 {args.batch}, {backend}, 배치마다 즉시 저장)")

    calibration = fetch_calibration()
    if calibration:
        print(f"   캘리브레이션 사례 {len(calibration)}건 주입")

    totals = {"updated": 0, "failed": 0, "fixes": 0}
    counts = {"pass": 0, "warn": 0, "fail": 0}
    fail_notes: list[str] = []
    n_batches = (len(cards) + args.batch - 1) // args.batch

    for bi in range(n_batches):
        batch = cards[bi * args.batch:(bi + 1) * args.batch]
        valid_ids = {c["id"] for c in batch if c.get("id")}
        with tempfile.TemporaryDirectory(prefix="bd-review-") as td:
            results, err = review_batch(bin_path, batch, tkst, calibration, Path(td))
        if err:
            print(f"   배치 {bi + 1}/{n_batches}: ❌ {err}"); continue
        mapped = [m for m in (to_result_item(r, valid_ids) for r in (results or [])) if m]
        for m in mapped:
            st = m.get("review_status") or ("pass" if m["score"] >= 85 else "warn" if m["score"] >= 60 else "fail")
            counts[st] += 1
            if st == "fail" and m.get("note"):
                fail_notes.append(f"{m['score']}점 {m['note'][:60]}")
        if args.dry_run:
            print(f"   배치 {bi + 1}/{n_batches}: (dry-run) {len(mapped)}건 검수 — 저장 생략")
            for m in mapped:
                print(f"      {m['score']:>3}점 {m.get('review_status', '?'):4} {m['note'][:70]}")
            continue
        r = post_results(mapped)
        totals = {k: totals[k] + r[k] for k in totals}
        print(f"   배치 {bi + 1}/{n_batches}: 저장 {r['updated']} / 실패 {r['failed']} / 보정 {r['fixes']}")

    print(f"✅ 검수 완료 — pass {counts['pass']} · warn {counts['warn']} · fail {counts['fail']}"
          f" | 저장 {totals['updated']} · 보정 {totals['fixes']} · 실패 {totals['failed']}")
    if fail_notes:
        print("   ⛔ fail 사유 상위:")
        for n in fail_notes[:8]:
            print(f"      - {n}")
    if scope == "pending" and counts["pass"] > 0 and not args.dry_run:
        print(f"   🤖 pass 고점수 카드는 다음 09:00 KST cron에서 자동 발행 예정")
    return 0


if __name__ == "__main__":
    sys.exit(main())

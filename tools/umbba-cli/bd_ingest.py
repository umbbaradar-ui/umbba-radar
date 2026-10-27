#!/usr/bin/env python3
"""
bd_ingest.py — Bright Data 풀파이프라인 운영 러너 (gallery-dl/쿠키 완전 대체).

흐름:
  1. 서버에서 활성 모니터링 계정 목록 fetch (ingest.fetch_active_usernames)
  2. BD discover by url (start_date=최근 N일 -> 신규만, 비용↓)로 한 번에 스캔
  3. 각 신규 게시물: 캡션 + 이미지URL 확보 -> CDN에서 이미지 받음 (쿠키 X)
  4. 기존 /api/admin/bulk-ingest-with-image 로 POST -> AI 분류 + pending 카드 (서버 무수정)
  5. 계정별 스캔 결과 보고 (last_scanned_at)

ingest.py 는 import 만 (무수정). 현행 gallery-dl 경로와 완전 분리.
롤백 = 이 스크립트 안 돌리고 기존 scan.bat 그대로 두면 끝.

사용:
  py bd_ingest.py --max-accounts 30 --recent 3 --scan-days 3
  py bd_ingest.py --accounts kahi_official boomcare.kr --dry-run   # 카드 생성 X, 경로 검증
"""
from __future__ import annotations

import argparse
import base64
import datetime
import html
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
import bd_client
import bd_hints
import os
import apify_client  # 예비 수집기 2 — Apify instagram-post-scraper
import hiker_client  # 예비 수집기 1 — BD 계정 스캔이 죽으면 같은 실행 안에서 자동 전환
import ingest  # 재사용(무수정): fetch_active_usernames, report_account_scan, API_URL/API_TOKEN/REQUEST_TIMEOUT
import source_map  # 게시물→계정 원장(예비 수집 우선순위 = 최근 카드 나온 계정)
from bd_notify import alert  # 수집 실패를 텔레그램으로 (조용한 0건 종료 방지)

# Gemini RPM 한도(OWNERSHIP: 15/분) 대응 — 카드 생성(=AI 호출) 사이 간격
CARD_SLEEP = 4.5


def upload_bytes(url: str, caption: str, image_bytes: bytes, mime: str, raw: bool = False,
                 source_post_date: str | None = None) -> dict:
    """bulk-ingest-with-image 로 이미지 bytes + 캡션 POST.
    raw=False: Vision 분류 + pending 카드(유료). raw=True: Vision 안 부르고 draft(미분류) 카드.
    source_post_date: 원문 게시일(인스타 date_posted) — 상시 자동마감(게시일+7) 기준."""
    if not ingest.API_TOKEN:
        return {"ok": False, "error": "ADMIN_CLI_TOKEN 미설정"}
    b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {"url": url, "caption": caption, "image_base64": b64, "image_mime": mime}
    if raw:
        payload["raw"] = True
    if source_post_date:
        payload["source_post_date"] = source_post_date
    try:
        r = requests.post(
            f"{ingest.API_URL}/api/admin/bulk-ingest-with-image",
            headers={"Authorization": f"Bearer {ingest.API_TOKEN}",
                     "Content-Type": "application/json"},
            json=payload,
            timeout=ingest.REQUEST_TIMEOUT,
        )
    except requests.RequestException as e:
        return {"ok": False, "error": f"네트워크 오류: {e}"}
    try:
        return r.json()
    except Exception:
        return {"ok": False, "error": f"응답 파싱 실패 (status={r.status_code})"}


def process_records(records: list[dict], raw: bool, dry_run: bool) -> tuple[dict, dict]:
    """ready 스냅샷 records를 카드로 적재. (counts, per_user_new) 반환.
    counts = {created, dup, failed, noimg}. per_user_new = {author: 생성수}.
    리셰어 글은 author(user_posted)가 요청 계정과 다를 수 있음 — 버리지 않고 그대로 적재(dedup은 서버)."""
    pairs = [(m, r) for m, r in ((bd_client.map_record(r), r) for r in records) if m and m.get("url")]
    created = dup = failed = noimg = 0
    per_user_new: dict[str, int] = {}
    smap = source_map.load()
    for it, rec in pairs:
        author = it.get("source_username") or "?"
        img_url = it.get("image_url")
        if not img_url:
            print(f"  @{author} ⚠ 이미지 URL 없음 — skip"); noimg += 1; continue
        img, mime, ierr = bd_client.fetch_cdn_image(img_url)
        if not img:
            print(f"  @{author} ⚠ 이미지 fetch 실패: {ierr}"); failed += 1; continue
        clen = len(it.get("caption_preview") or "")
        if dry_run:
            print(f"  [DRY] @{author} {it.get('content_type')}  "
                  f"img {len(img)//1024}KB {mime}  cap {clen}자  {it['url']}")
            created += 1; per_user_new[author] = per_user_new.get(author, 0) + 1; continue
        res = upload_bytes(it["url"], it.get("caption_preview") or "", img, mime, raw=raw,
                           source_post_date=it.get("source_post_date"))
        st = res.get("status")
        if res.get("ok") and st == "created":
            ai = res.get("ai", {})
            tag = "draft(미분류)" if raw else f'pending "{(ai.get("title") or "")[:30]}"'
            print(f"  ✅ @{author} {tag}"); created += 1
            per_user_new[author] = per_user_new.get(author, 0) + 1
            # 캐러셀 이미지 속 마감·기간 글자(alt_text) 사이드카 — 검수 note 힌트용 (bd_hints)
            bd_hints.save(res.get("post_id") or "", rec)
            source_map.add(it["url"], author, it.get("source_post_date"), smap)
        elif st == "duplicate":
            dup += 1
        elif st == "skipped":
            print(f"  🚫 @{author} AI skip(노이즈)"); dup += 1
        else:
            print(f"  ❌ @{author} {res.get('error', st)}"); failed += 1
        time.sleep(CARD_SLEEP)
    if created and not dry_run:
        source_map.save(smap)
    return ({"created": created, "dup": dup, "failed": failed, "noimg": noimg}, per_user_new)


def scan_chunk(chunk: list[str], recent: int, start_date: str,
               start_dates: dict | None, raw: bool, dry_run: bool) -> dict | None:
    """한 청크: trigger→wait→fetch→적재. 실패면 None(복구용 snapshot_id 로그).
    성공이면 counts(+billed, +per_user_new) 반환."""
    sid, err = bd_client.trigger_discover(chunk, recent, start_date, start_dates=start_dates)
    if err:
        print(f"   ❌ {err}"); return None
    print(f"   snapshot_id={sid}")
    ok, prog = bd_client.wait_ready(sid)
    if not ok:
        # 우리 폴링만 끊겼을 수 있음 → BD가 늦게 끝내면 --snapshot {sid} 로 재과금 없이 복구 가능.
        print(f"   ❌ 스냅샷 실패: {prog} — 나중 복구: --snapshot {sid}"); return None
    records, ferr = bd_client.fetch_snapshot(sid)
    if ferr:
        print(f"   ❌ {ferr} — 나중 복구: --snapshot {sid}"); return None
    billed, errc = prog.get("records"), prog.get("errors")
    print(f"   📦 records(과금) {billed} / errors(무과금) {errc} / 수신 {len(records)}건")
    counts, per_user_new = process_records(records, raw, dry_run)
    counts["billed"] = billed or 0
    counts["per_user_new"] = per_user_new
    # 수신량 급감 판정용(main) — 평소 800계정 → 800~900건, BD 크롤러 고장 땐 10~20건(2026-10-22~)
    counts["received"] = len(records)
    counts["error_codes"] = prog.get("error_codes") or {}
    counts["error_sample"] = next((r["error"] for r in records if r.get("error")), "")
    counts["sid"] = sid
    return counts


PROVIDERS = {"hiker": hiker_client, "apify": apify_client}


def run_fallback(pool: list[str], tonight: list[str], new_set: set[str], args) -> dict:
    """예비 수집 체인: 최근 60일 카드 나온 계정 우선 → 나머지는 이번 회차 순서, --fallback-max 까지.
    업체는 FALLBACK_ORDER(.env, 기본 hiker,apify) 순서. 미설정·잔액 0이면 건너뛰고, 앞 업체가 못 본 계정만 다음 업체로.
    카드 적재는 BD 와 같은 process_records. 반환 = 요약·알림용 {"steps": [...], scanned, unscanned, created…}."""
    order = [args.provider] if args.provider in PROVIDERS else \
        [p.strip() for p in (os.getenv("FALLBACK_ORDER") or "hiker,apify").split(",") if p.strip() in PROVIDERS]
    in_pool = {u.lower() for u in pool}
    first = [u for u, _, _ in source_map.rank(60) if u in in_pool]
    seen = set(first)
    targets = (first + [u for u in (x.lower() for x in tonight) if u not in seen])[:args.fallback_max]
    today = datetime.date.today()
    since_old = today - datetime.timedelta(days=args.scan_days) if args.scan_days > 0 else None
    since_new = today - datetime.timedelta(days=args.new_scan_days) if args.new_scan_days > 0 else None
    since = {u: since_new for u in targets if u in new_set}
    print(f"\n=== 예비 수집 {len(targets)}계정 — 최근 카드 계정 {min(len(first), len(targets))}개 우선, "
          f"상한 {args.fallback_max}, 순서 {' → '.join(PROVIDERS[p].NAME for p in order)} ===")
    out = {"steps": [], "targets": len(targets), "scanned": 0, "created": 0, "dup": 0, "failed": 0, "noimg": 0}
    remaining = list(targets)
    for key in order:
        prov = PROVIDERS[key]
        step = {"name": prov.NAME, "env": prov.ENV_KEY, "asked": len(remaining)}
        out["steps"].append(step)
        if not remaining:
            step["skip"] = "남은 계정 없음"; continue
        if not prov.configured():
            step["skip"] = f"미설정(.env {prov.ENV_KEY})"; print(f"   ⏭ {prov.NAME} {step['skip']}"); continue
        ok, why = prov.ready()
        if not ok:
            step["skip"] = why; print(f"   ⏭ {prov.NAME} {why}"); continue
        print(f"\n--- {prov.NAME}: {len(remaining)}계정 ---")
        recs, st = prov.discover(remaining, args.recent, since, since_old)
        print(f"   📦 조회 {st['scanned']}/{len(remaining)}계정 · 게시물 {len(recs)}건 ≈ {st['won']}원"
              + (" · ⛔ 비용 상한" if st["budget_stop"] else "") + (" · ⛔ 잔액 소진" if st["no_funds"] else ""))
        counts, pun = process_records(recs, args.raw, args.dry_run)
        if not args.dry_run:
            pun = {k.lower(): v for k, v in pun.items()}
            for u in st["scanned_users"]:
                ingest.report_account_scan(u, pun.get(u, 0), None)
        bl, low = prov.balance_info()
        step.update({k: st[k] for k in ("scanned", "won", "budget_stop", "no_funds", "notfound", "errors")},
                    posts=len(recs), created=counts["created"], balance=bl, low=low)
        out["scanned"] += st["scanned"]
        for k in ("created", "dup", "failed", "noimg"):
            out[k] += counts[k]
        done = set(st["scanned_users"]) | set(st.get("notfound_users") or [])
        remaining = [u for u in remaining if u not in done]
    out["unscanned"] = len(remaining)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Bright Data 풀파이프라인 운영 러너")
    ap.add_argument("--max-accounts", type=int, default=30, help="이번 회차 최대 계정 수")
    ap.add_argument("--recent", type=int, default=3, help="계정당 최근 N개(상한)")
    ap.add_argument("--scan-days", type=int, default=3,
                    help="최근 N일 글만(start_date) = 신규필터·비용↓. 0=필터없음")
    ap.add_argument("--new-scan-days", type=int, default=3,
                    help="신규 계정(첫 스캔=last_scanned 없음)만 과거 N일 백필. 기존 계정은 --scan-days. "
                         "0=날짜무관 최근 recent개. (놓친 최근 딜 회수용, 계정당 recent 상한)")
    ap.add_argument("--accounts", nargs="*",
                    help="계정 직접 지정(테스트용, 서버 fetch 대신)")
    ap.add_argument("--snapshot",
                    help="기존 스냅샷 id 재처리(재스캔/재과금 없음). 실패 복구·수동용")
    ap.add_argument("--raw", action="store_true",
                    help="수집 루틴: Vision 안 부르고 draft(미분류) 카드 생성(유료 API 0). 분류는 bd_classify.py가 별도로.")
    ap.add_argument("--dry-run", action="store_true",
                    help="BD 스캔 + 이미지 fetch 까지만. 카드 생성·보고 X")
    ap.add_argument("--chunk-size", type=int, default=0,
                    help="계정을 N개씩 끊어 청크별 독립 스냅샷(0=한 번에). "
                         "큰 명단의 단일-스냅샷 타임아웃·올오어낫싱 방지 + 부분 성공.")
    ap.add_argument("--chunk-sleep", type=int, default=0,
                    help="청크 사이 대기 초(BD 부하 분산·차단 완화). chunk-size>0 일 때만 의미.")
    ap.add_argument("--provider", choices=("auto", "bd", "fallback", "hiker", "apify"), default="auto",
                    help="auto=BD 먼저, 응답 이상이면 예비 체인(FALLBACK_ORDER) 자동 전환 / bd=BD만 / "
                         "fallback=BD 건너뛰고 예비 체인 / hiker·apify=BD 건너뛰고 그 업체만(강제 전환·테스트)")
    ap.add_argument("--fallback-max", type=int, default=300,
                    help="예비 수집 계정 상한(최근 카드 나온 계정 우선) — 1계정 ≈ 1요청(첫 회만 2)")
    args = ap.parse_args()

    if not bd_client.configured():
        print("❌ .env BRIGHTDATA_API_TOKEN 미설정")
        return 1
    if not ingest.API_TOKEN:
        print("❌ .env ADMIN_CLI_TOKEN 미설정")
        return 1

    # A) 기존 스냅샷 재처리(--snapshot) — 재스캔/재과금 없이 이미 만들어진 것만 적재(실패 복구·수동용)
    if args.snapshot:
        sid = args.snapshot
        print(f"🔁 기존 스냅샷 재처리(재과금 없음): {sid}")
        prog = bd_client.progress(sid)
        records, ferr = bd_client.fetch_snapshot(sid)
        if ferr:
            print(f"❌ {ferr}"); return 1
        billed, errc = prog.get("records"), prog.get("errors")
        print(f"\n📦 records(과금) {billed} / errors(무과금) {errc} / 수신 {len(records)}건\n")
        counts, _ = process_records(records, args.raw, args.dry_run)
        print("\n" + "=" * 52)
        print(f"✅ 생성 {counts['created']} / 중복·skip {counts['dup']} / "
              f"실패 {counts['failed']} / 이미지없음 {counts['noimg']}")
        cost_won = (billed or 0) * 1.5 / 1000 * 1400
        print(f"   과금 {billed} records ≈ {cost_won:.0f}원")
        if not args.dry_run:
            print(f"   검수: {ingest.API_URL}/admin/queue")
        return 0

    # B) 새 스캔 — 계정 목록 + 신규(last_scanned 없음) 판별. 수동 --accounts 는 메타 없음 → 백필 대상 아님.
    new_set: set[str] = set()
    if args.accounts:
        usernames = [u.strip().lstrip("@") for u in args.accounts if u.strip()]
    else:
        accounts = ingest.fetch_active_accounts()
        usernames = [a["username"] for a in accounts if a.get("username")]
        new_set = {a["username"].lower() for a in accounts
                   if a.get("username") and a.get("last_scanned_at") is None}
    if not usernames:
        print("📡 활성 계정 0개. /admin/accounts 에서 등록.")
        return 0
    all_usernames = list(usernames)   # 예비 수집은 회전(800)과 무관하게 전체 활성 중 우선순위로
    if len(usernames) > args.max_accounts:
        print(f"⚠️ {len(usernames)}개 중 {args.max_accounts}개만 이번 회차 (last_scanned 오래된 순)")
        usernames = usernames[:args.max_accounts]

    # start_date(신규필터) — MM-DD-YYYY. 기존 계정 공통값.
    start_date = ""
    if args.scan_days > 0:
        d = datetime.datetime.now() - datetime.timedelta(days=args.scan_days)
        start_date = d.strftime("%m-%d-%Y")
    # 신규 계정 첫스캔 백필: 과거 new_scan_days 일까지(계정별 오버라이드). 0이면 날짜무관(최근 recent개).
    new_start_date = ""
    if args.new_scan_days > 0:
        d = datetime.datetime.now() - datetime.timedelta(days=args.new_scan_days)
        new_start_date = d.strftime("%m-%d-%Y")
    scanned_new = [u for u in usernames if u.lower() in new_set]
    start_dates = {u: new_start_date for u in scanned_new} if scanned_new else None

    # 청크 분할: chunk_size>0 이면 N개씩 끊어 청크별 독립 스냅샷(타임아웃·올오어낫싱 방지). 0=한 번에.
    cs = args.chunk_size if args.chunk_size and args.chunk_size > 0 else len(usernames)
    chunks = [usernames[i:i + cs] for i in range(0, len(usernames), cs)] or [[]]
    bd_on = args.provider in ("auto", "bd")
    print(f"🔭 BD 스캔: {len(usernames)}계정(신규 백필 {len(scanned_new)}개) → "
          f"청크 {len(chunks)}개(≤{cs}), recent {args.recent}, "
          f"start_date {start_date or '(없음)'}/신규 {new_start_date or '(없음)'}"
          + ("  [DRY RUN]" if args.dry_run else "") if bd_on else f"⏭ --provider {args.provider} — BD 건너뜀")

    tot = {"created": 0, "dup": 0, "failed": 0, "noimg": 0, "billed": 0}
    failed_chunks = 0
    ok_accounts = received = 0
    err_codes: dict[str, int] = {}
    err_sample, sids = "", []
    for ci, chunk in enumerate(chunks if bd_on else []):
        if ci > 0 and args.chunk_sleep > 0:
            print(f"   ⏳ 청크 간 대기 {args.chunk_sleep}s (BD 부하 분산)")
            time.sleep(args.chunk_sleep)
        print(f"\n=== 청크 {ci + 1}/{len(chunks)} ({len(chunk)}계정) ===")
        c = scan_chunk(chunk, args.recent, start_date, start_dates, args.raw, args.dry_run)
        if c is None:
            failed_chunks += 1
            print(f"   ⚠ 청크 {ci + 1} 실패 — 건너뜀(나머지 청크 계속)")
            continue
        for k in ("created", "dup", "failed", "noimg", "billed"):
            tot[k] += c[k]
        ok_accounts += len(chunk); received += c["received"]; sids.append(c["sid"])
        for code, n in c["error_codes"].items():
            err_codes[code] = err_codes.get(code, 0) + n
        err_sample = err_sample or c["error_sample"]
        # 이 청크 계정만 즉시 last_scanned 갱신 → 중간에 끊겨도 진행분 보존·회전 유지.
        if not args.dry_run:
            pun = c["per_user_new"]
            for u in chunk:
                ingest.report_account_scan(u, pun.get(u, 0), None)

    bd_created = tot["created"]
    # BD 이상 판정: 청크 전멸(07-21 스냅샷 빌드 실패) 또는 스냅샷은 성공인데 거의 빈 응답(10-22~ crawl_error 'pk':
    # 5일간 생성 0, 경보 0). 정상은 계정수 이상 수신(게시물+무과금 오류 행). 소량 수동 테스트(<50계정)는 판정 안 함.
    all_failed = bd_on and failed_chunks == len(chunks)
    starved = bd_on and ok_accounts >= 50 and received < ok_accounts * 0.1
    bd_dead = len(usernames) >= 50 and (all_failed or starved)

    # 예비 수집기 자동 전환(같은 실행 안) — auto 에서 BD 이상일 때, 또는 --provider hiker
    fb = None
    forced = not bd_on
    if forced or (args.provider == "auto" and bd_dead):
        fb = run_fallback(all_usernames, usernames, new_set, args)
        for k in ("created", "dup", "failed", "noimg"):
            tot[k] += fb[k]
    fb_ok = bool(fb) and fb["scanned"] > 0

    print("\n" + "=" * 52)
    print(f"✅ 생성 {tot['created']} / 중복·skip {tot['dup']} / "
          f"실패 {tot['failed']} / 이미지없음 {tot['noimg']}")
    cost_won = tot["billed"] * 1.5 / 1000 * 1400
    tail = f" / 실패 청크 {failed_chunks}/{len(chunks)}" if failed_chunks else ""
    print(f"   과금 {tot['billed']} records ≈ {cost_won:.0f}원{tail}")
    for stp in (fb or {}).get("steps", []):
        if "scanned" in stp:
            print(f"   예비 {stp['name']} 조회 {stp['scanned']}계정 · 신규 {stp['created']} ≈ {stp['won']}원 · {stp['balance']}")
    if not args.dry_run:
        print(f"   검수: {ingest.API_URL}/admin/queue")
    if args.dry_run:
        return 0 if (not bd_on or failed_chunks < len(chunks)) else 1

    if bd_dead or (forced and not (fb_ok and fb["unscanned"] == 0)):
        # 한 통으로: BD 상태 + 예비 업체별 결과. 예비가 전부 살렸으면 🟡(조치 불필요), 미조회·실패 남으면 🔴.
        lines = []
        if all_failed:
            lines.append(f"BD 청크 {failed_chunks}/{len(chunks)} 실패 — 스냅샷 빌드 실패(계정 잠금·한도·장애) 가능성")
        elif bd_on:
            codes = ", ".join(f"{k} {v}" for k, v in sorted(err_codes.items(), key=lambda kv: -kv[1])) or "없음"
            lines += [f"BD: 요청 {ok_accounts}계정 → 수신 {received}건 (평소 계정수 이상, 기준 10% = {int(ok_accounts * 0.1)}건)",
                      f"BD 신규 {bd_created}건 · 오류 코드: {codes}",
                      f"오류 예: {html.escape(err_sample[:120], quote=False)}" if err_sample else "오류 행도 없음(빈 응답)",  # parse_mode=HTML
                      f"snapshot: {', '.join(sids)}"]
        if lines:
            lines.append("")
        charge = []
        if fb is None:
            lines.append("예비 수집 꺼짐(--provider bd)")
        else:
            lines.append(f"예비 수집 대상 {fb['targets']}계정(최근 카드 계정 우선)")
        for stp in (fb or {}).get("steps", []):
            if "skip" in stp:
                lines.append(f"· {stp['name']}: {stp['skip']}")
                if "잔액" in stp["skip"] or "한도" in stp["skip"]:
                    charge.append(stp["name"])
                continue
            flags = (" ⛔ 비용 상한" if stp["budget_stop"] else "") + (" ⛔ 잔액 소진" if stp["no_funds"] else "")
            lines.append(f"· {stp['name']}: {stp['scanned']}/{stp['asked']}계정 조회 · 게시물 {stp['posts']}건 · "
                         f"신규 카드 {stp['created']}건 · ≈{stp['won']}원 · {stp['balance']}"
                         + (" ⚠ 충전 필요" if stp["low"] else "") + flags)
            if stp["low"] or stp["no_funds"]:
                charge.append(stp["name"])
        if fb and fb["unscanned"]:
            lines.append(f"⛔ 미조회 {fb['unscanned']}계정 — 예비 업체 키·잔액·한도 확인")
        whole = fb_ok and fb["unscanned"] == 0
        action = (f"{'·'.join(charge)} 충전 · " if charge else "") + (
            "BD 복구 전까지 매일 자동 전환(그 외 조치 불필요)" if whole
            else "예비 업체 키·잔액 확인 · 복구 전엔 /admin/bulk-ingest 수동 큐로 보충")
        alert(
            ("엄빠레이더 수집 급감 — BD 응답 이상" + (" → 예비 수집 전환" if fb_ok else "")) if bd_on
            else "엄빠레이더 예비 수집 " + ("일부 실패" if fb_ok else "실패"),
            lines, action,
            icon="🟡" if whole else "🔴",
        )
    elif failed_chunks:
        # 일부 청크만 실패(나머지는 수집됨) 또는 소량 수동 실행 실패 — 전환 안 함
        alert(
            "엄빠레이더 수집 실패" if all_failed else "엄빠레이더 수집 일부 실패",
            [f"청크 {failed_chunks}/{len(chunks)} 실패 — 신규 카드 {tot['created']}건.",
             "BD 스냅샷 빌드 실패(계정 잠금·한도·장애) 가능성이 높습니다."
             if all_failed else "일부 계정이 이번 회차에서 누락됐습니다.",
             "", f"과금 {tot['billed']} records ≈ {cost_won:.0f}원"],
            "BD 대시보드에서 계정 상태·잔여 크레딧 확인 필요",
        )
    if bd_on and failed_chunks == len(chunks):
        return 0 if fb_ok else 1
    return 0 if (bd_on or fb_ok) else 1


if __name__ == "__main__":
    sys.exit(main())

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
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
import bd_client
import ingest  # 재사용(무수정): fetch_active_usernames, report_account_scan, API_URL/API_TOKEN/REQUEST_TIMEOUT

# Gemini RPM 한도(OWNERSHIP: 15/분) 대응 — 카드 생성(=AI 호출) 사이 간격
CARD_SLEEP = 4.5


def upload_bytes(url: str, caption: str, image_bytes: bytes, mime: str, raw: bool = False) -> dict:
    """bulk-ingest-with-image 로 이미지 bytes + 캡션 POST.
    raw=False: Vision 분류 + pending 카드(유료). raw=True: Vision 안 부르고 draft(미분류) 카드."""
    if not ingest.API_TOKEN:
        return {"ok": False, "error": "ADMIN_CLI_TOKEN 미설정"}
    b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {"url": url, "caption": caption, "image_base64": b64, "image_mime": mime}
    if raw:
        payload["raw"] = True
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


def main() -> int:
    ap = argparse.ArgumentParser(description="Bright Data 풀파이프라인 운영 러너")
    ap.add_argument("--max-accounts", type=int, default=30, help="이번 회차 최대 계정 수")
    ap.add_argument("--recent", type=int, default=3, help="계정당 최근 N개(상한)")
    ap.add_argument("--scan-days", type=int, default=3,
                    help="최근 N일 글만(start_date) = 신규필터·비용↓. 0=필터없음")
    ap.add_argument("--accounts", nargs="*",
                    help="계정 직접 지정(테스트용, 서버 fetch 대신)")
    ap.add_argument("--snapshot",
                    help="기존 스냅샷 id 재처리(재스캔/재과금 없음). 실패 복구·수동용")
    ap.add_argument("--raw", action="store_true",
                    help="수집 루틴: Vision 안 부르고 draft(미분류) 카드 생성(유료 API 0). 분류는 bd_classify.py가 별도로.")
    ap.add_argument("--dry-run", action="store_true",
                    help="BD 스캔 + 이미지 fetch 까지만. 카드 생성·보고 X")
    args = ap.parse_args()

    if not bd_client.configured():
        print("❌ .env BRIGHTDATA_API_TOKEN 미설정")
        return 1
    if not ingest.API_TOKEN:
        print("❌ .env ADMIN_CLI_TOKEN 미설정")
        return 1

    # 1) 스냅샷 확보 — 기존 스냅샷 재처리(--snapshot) 또는 새 스캔
    if args.snapshot:
        # 재스캔/재과금 없이 이미 만들어진 스냅샷만 처리 (실패 복구·수동용)
        usernames = []
        sid = args.snapshot
        print(f"🔁 기존 스냅샷 재처리(재과금 없음): {sid}")
        prog = bd_client.progress(sid)
    else:
        if args.accounts:
            usernames = [u.strip().lstrip("@") for u in args.accounts if u.strip()]
        else:
            usernames = ingest.fetch_active_usernames()
        if not usernames:
            print("📡 활성 계정 0개. /admin/accounts 에서 등록.")
            return 0
        if len(usernames) > args.max_accounts:
            print(f"⚠️ {len(usernames)}개 중 {args.max_accounts}개만 이번 회차 (last_scanned 오래된 순)")
            usernames = usernames[:args.max_accounts]

        # start_date(신규필터) — MM-DD-YYYY
        start_date = ""
        if args.scan_days > 0:
            d = datetime.datetime.now() - datetime.timedelta(days=args.scan_days)
            start_date = d.strftime("%m-%d-%Y")

        print(f"🔭 BD 풀스캔: {len(usernames)}계정, recent {args.recent}, "
              f"start_date {start_date or '(없음)'}"
              + ("  [DRY RUN]" if args.dry_run else ""))

        # BD discover (비동기 1콜 -> 폴링)
        sid, err = bd_client.trigger_discover(usernames, args.recent, start_date)
        if err:
            print(f"❌ {err}")
            return 1
        print(f"   snapshot_id={sid}")
        ok, prog = bd_client.wait_ready(sid)
        if not ok:
            print(f"❌ 스냅샷 실패: {prog}")
            return 1

    # 2) 데이터 가져오기 (ready 직후 202 building 이면 자동 재시도)
    records, ferr = bd_client.fetch_snapshot(sid)
    if ferr:
        print(f"❌ {ferr}")
        return 1
    billed, errc = prog.get("records"), prog.get("errors")
    print(f"\n📦 records(과금) {billed} / errors(무과금) {errc} / 수신 {len(records)}건\n")

    # 3) 모든 과금 레코드 처리.
    #    주의: BD discover는 모니터링 계정이 "리셰어한" 글을 원작자(user_posted)로 표기하기도 함
    #    -> 요청 계정명과 안 맞아도 버리지 말 것(과금된 record를 안 쓰면 돈 낭비). dedup은 서버가 url로 함.
    mapped = [m for m in (bd_client.map_record(r) for r in records) if m and m.get("url")]

    created = dup = failed = noimg = 0
    per_user_new: dict[str, int] = {}
    for it in mapped:
        author = it.get("source_username") or "?"
        img_url = it.get("image_url")
        if not img_url:
            print(f"  @{author} ⚠ 이미지 URL 없음 — skip")
            noimg += 1
            continue
        img, mime, ierr = bd_client.fetch_cdn_image(img_url)
        if not img:
            print(f"  @{author} ⚠ 이미지 fetch 실패: {ierr}")
            failed += 1
            continue

        clen = len(it.get("caption_preview") or "")
        if args.dry_run:
            print(f"  [DRY] @{author} {it.get('content_type')}  "
                  f"img {len(img)//1024}KB {mime}  cap {clen}자  {it['url']}")
            created += 1
            per_user_new[author] = per_user_new.get(author, 0) + 1
            continue

        res = upload_bytes(it["url"], it.get("caption_preview") or "", img, mime, raw=args.raw)
        st = res.get("status")
        if res.get("ok") and st == "created":
            ai = res.get("ai", {})
            tag = "draft(미분류)" if args.raw else f'pending "{(ai.get("title") or "")[:30]}"'
            print(f"  ✅ @{author} {tag}")
            created += 1
            per_user_new[author] = per_user_new.get(author, 0) + 1
        elif st == "duplicate":
            dup += 1
        elif st == "skipped":
            print(f"  🚫 @{author} AI skip(노이즈)")
            dup += 1
        else:
            print(f"  ❌ @{author} {res.get('error', st)}")
            failed += 1
        time.sleep(CARD_SLEEP)

    # 4) 요청한 계정 전부 last_scanned_at 갱신(회전용). 리셰어 author는 매칭 0이어도 계정은 갱신됨.
    if not args.dry_run:
        for username in usernames:
            ingest.report_account_scan(username, per_user_new.get(username, 0), None)

    print("\n" + "=" * 52)
    print(f"✅ 생성 {created} / 중복·skip {dup} / 실패 {failed} / 이미지없음 {noimg}")
    cost_won = (billed or 0) * 1.5 / 1000 * 1400
    print(f"   과금 {billed} records ≈ {cost_won:.0f}원")
    if not args.dry_run:
        print(f"   검수: {ingest.API_URL}/admin/queue")
    return 0


if __name__ == "__main__":
    sys.exit(main())

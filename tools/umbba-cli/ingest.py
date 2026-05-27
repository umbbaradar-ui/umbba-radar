#!/usr/bin/env python3
"""
umbba-cli — 인스타 게시물 일괄 등록 CLI

사용:
    $ python ingest.py urls.txt

요구:
    Python 3.10+, gallery-dl, requests, python-dotenv
    설치: pip install -r requirements.txt

흐름:
    1. urls.txt 한 줄에 인스타 URL 하나
    2. gallery-dl로 각 게시물 이미지·캡션 다운 (본인 IP 사용 → 차단 ↓)
    3. 우리 Vercel API에 POST → Storage 업로드 + AI 분류 + draft 생성
    4. /admin/queue에서 검수 → 발행

설정:
    .env 파일에 ADMIN_CLI_TOKEN, UMBBA_API_URL 입력 (.env.example 참조)
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional, TypedDict

# Windows 콘솔(cp949) 이모지 깨짐 방지 — PowerShell·cmd·작업 스케줄러 모두 대응
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    import requests
    from dotenv import load_dotenv
except ImportError:
    print("필수 패키지 미설치 — 먼저 실행:")
    print("    pip install -r requirements.txt")
    sys.exit(1)


# ============================================
# 설정
# ============================================
load_dotenv()

API_URL = os.getenv("UMBBA_API_URL", "https://umbba-radar.com").rstrip("/")
API_TOKEN = os.getenv("ADMIN_CLI_TOKEN")
REQUEST_TIMEOUT = 60  # Vercel maxDuration과 일치

# 차단 회피용 약한 backoff (각 URL 사이 짧은 sleep)
SLEEP_BETWEEN_URLS = float(os.getenv("UMBBA_SLEEP", "2.0"))

# 인스타 로그인 쿠키 — 둘 중 하나
#   UMBBA_COOKIES_FILE: cookies.txt 형식 파일 경로 (Firefox 확장으로 export)
#   UMBBA_COOKIES_BROWSER: 브라우저 이름 (firefox·chrome·edge — DPAPI 이슈로 Chrome 비추천)
COOKIES_FILE = os.getenv("UMBBA_COOKIES_FILE", "").strip() or None
COOKIES_BROWSER = os.getenv("UMBBA_COOKIES_BROWSER", "").strip() or None


# ============================================
# 타입
# ============================================
class DownloadedPost(TypedDict):
    image_path: Path
    caption: str
    mime: str


# ============================================
# gallery-dl wrapping
#
# sys.executable + "-m gallery_dl" 호출 → PATH 무관하게 동작.
# (Windows pip 설치 시 Scripts 폴더가 PATH에 없는 경우 흔함)
# ============================================
GALLERY_DL_CMD = [sys.executable, "-m", "gallery_dl"]


def build_gallery_dl_command(url: str, work_dir: Path) -> list[str]:
    """gallery-dl 명령어 조립. 쿠키 옵션이 있으면 자동 추가."""
    cmd = [
        *GALLERY_DL_CMD,
        "--write-metadata",
        "--dest", str(work_dir),
    ]
    # 인스타 비로그인 차단 회피용 쿠키
    if COOKIES_FILE:
        cmd += ["--cookies", COOKIES_FILE]
    elif COOKIES_BROWSER:
        cmd += ["--cookies-from-browser", COOKIES_BROWSER]
    cmd.append(url)
    return cmd


def download_post(url: str, work_dir: Path) -> Optional[DownloadedPost]:
    """gallery-dl로 인스타 게시물 이미지·메타 다운"""
    try:
        # --write-metadata: 캡션·메타를 .json 파일로 저장
        # --dest: 출력 디렉토리
        # 쿠키: UMBBA_COOKIES_FILE 또는 UMBBA_COOKIES_BROWSER (인스타 로그인 차단 회피)
        result = subprocess.run(
            build_gallery_dl_command(url, work_dir),
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            err = (result.stderr or "").strip().splitlines()
            last = err[-1] if err else "(에러 메시지 없음)"
            print(f"    ❌ gallery-dl 실패: {last}")
            return None
    except subprocess.TimeoutExpired:
        print("    ❌ gallery-dl 타임아웃 (60s)")
        return None
    except Exception as e:
        print(f"    ❌ gallery-dl 실행 오류: {e}")
        return None

    # 다운된 파일 찾기 — gallery-dl이 work_dir 하위에 폴더 만들어 저장
    image_files = []
    metadata_files = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
        image_files.extend(work_dir.rglob(ext))
    for meta_file in work_dir.rglob("*.json"):
        metadata_files.append(meta_file)

    if not image_files:
        print("    ❌ 다운된 이미지 없음 (영상이면 썸네일 다운 옵션 추가 필요)")
        return None

    # 가장 큰 이미지 = 메인 이미지 (영상 게시물의 썸네일 후보)
    main_image = max(image_files, key=lambda p: p.stat().st_size)

    # 캡션은 첫 번째 metadata json에서 description 필드 추출
    caption = ""
    if metadata_files:
        try:
            meta = json.loads(metadata_files[0].read_text(encoding="utf-8"))
            caption = (
                meta.get("description")
                or meta.get("title")
                or meta.get("content")
                or ""
            )
        except Exception:
            pass

    mime = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(main_image.suffix.lower(), "image/jpeg")

    return DownloadedPost(
        image_path=main_image,
        caption=caption,
        mime=mime,
    )


# ============================================
# Vercel API 호출
# ============================================
def upload_to_api(url: str, post: DownloadedPost) -> dict:
    """우리 Vercel API에 POST"""
    if not API_TOKEN:
        return {"ok": False, "error": ".env의 ADMIN_CLI_TOKEN 미설정"}

    image_bytes = post["image_path"].read_bytes()
    image_b64 = base64.b64encode(image_bytes).decode("ascii")

    try:
        r = requests.post(
            f"{API_URL}/api/admin/bulk-ingest-with-image",
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "url": url,
                "caption": post["caption"],
                "image_base64": image_b64,
                "image_mime": post["mime"],
            },
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as e:
        return {"ok": False, "error": f"네트워크 오류: {e}"}

    try:
        return r.json()
    except Exception:
        return {"ok": False, "error": f"응답 파싱 실패 (status={r.status_code})"}


# ============================================
# 메인
# ============================================
def parse_urls(file_path: Path) -> list[str]:
    """파일에서 URL 목록 — 줄바꿈, 주석(#) 제외.
    utf-8-sig 인코딩 사용 — PowerShell `Out-File -Encoding utf8`이 BOM 붙이는 케이스 대응."""
    if not file_path.exists():
        print(f"❌ 파일이 없어요: {file_path}")
        sys.exit(1)
    urls = []
    for raw_line in file_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip().lstrip("﻿")  # 추가 BOM safety net
        if not line or line.startswith("#"):
            continue
        if not line.startswith(("http://", "https://")):
            continue
        urls.append(line)
    # 중복 제거 (순서 보존)
    seen = set()
    result = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result


def pull_from_queue(limit: int) -> list[dict]:
    """서버의 ingest_queue 에서 todo N개 atomic claim → [{id, url}, ...]"""
    if not API_TOKEN:
        print("⚠️  .env에 ADMIN_CLI_TOKEN 설정 필요")
        return []
    try:
        r = requests.get(
            f"{API_URL}/api/admin/queue/pull?limit={limit}",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            timeout=30,
        )
    except requests.RequestException as e:
        print(f"❌ 큐 pull 네트워크 오류: {e}")
        return []
    try:
        data = r.json()
    except Exception:
        print(f"❌ 큐 pull 응답 파싱 실패 (status={r.status_code})")
        return []
    if not data.get("ok"):
        print(f"❌ 큐 pull 실패: {data.get('error', 'unknown')}")
        return []
    items = data.get("items", [])
    reaped = data.get("reaped", 0)
    if reaped:
        print(f"   ↻ 죽은 processing {reaped}개 → todo 복귀")
    return items


def report_complete(queue_id: str, status: str, post_id: str | None = None,
                    error: str | None = None) -> None:
    """큐 항목 완료 보고: done/duplicate/failed"""
    if not API_TOKEN:
        return
    body = {"id": queue_id, "status": status}
    if post_id:
        body["post_id"] = post_id
    if error:
        body["error"] = error[:500]
    try:
        requests.post(
            f"{API_URL}/api/admin/queue/complete",
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
    except requests.RequestException as e:
        print(f"    ⚠️ 완료 보고 실패 (다음 pull 에서 자동 복구): {e}")


def process_url(url: str, queue_id: str | None, dry_run: bool) -> str:
    """URL 한 개 처리 → 'created' | 'duplicate' | 'failed' 반환"""
    with tempfile.TemporaryDirectory(prefix="umbba-") as tmp:
        work_dir = Path(tmp)

        post = download_post(url, work_dir)
        if not post:
            if queue_id:
                report_complete(queue_id, "failed",
                                error="gallery-dl 다운로드 실패 (비공개·삭제·쿠키 만료 가능)")
            return "failed"

        print(
            f"    📥 이미지 {post['image_path'].stat().st_size // 1024}KB "
            f"+ 캡션 {len(post['caption'])}자"
        )

        if dry_run:
            return "created"

        result = upload_to_api(url, post)
        if result.get("ok"):
            status = result.get("status", "created")
            post_id = result.get("post_id")
            if status == "duplicate":
                print(f"    🔁 중복 (post_id={post_id[:8] if post_id else '?'}...)")
                if queue_id and post_id:
                    report_complete(queue_id, "duplicate", post_id=post_id)
                return "duplicate"
            else:
                ai = result.get("ai", {})
                title = ai.get("title", "(분류 실패)")
                conf = ai.get("confidence", 0)
                print(
                    f"    ✅ pending 생성 — \"{title[:40]}\""
                    f"{f' (신뢰도 {conf:.0%})' if conf else ''}"
                )
                if queue_id:
                    report_complete(queue_id, "done", post_id=post_id)
                return "created"
        else:
            err = result.get("error", "unknown error")
            print(f"    ❌ {err}")
            if queue_id:
                report_complete(queue_id, "failed", error=err)
            return "failed"


# ============================================
# --scan 모드 — 활성 인스타 계정 순회 → 신규 게시물 URL 만 큐에 push
# Claude 호출 안 함 (비용 0). 큐는 사용자가 수동으로 --pull 트리거.
# ============================================

def fetch_active_usernames() -> list[str]:
    """서버에서 활성 모니터링 계정 목록 가져옴"""
    if not API_TOKEN:
        return []
    try:
        r = requests.get(
            f"{API_URL}/api/admin/accounts/active",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            timeout=30,
        )
        data = r.json()
        if not data.get("ok"):
            print(f"❌ accounts/active 실패: {data.get('error', 'unknown')}")
            return []
        return data.get("usernames", [])
    except requests.RequestException as e:
        print(f"❌ accounts/active 네트워크 오류: {e}")
        return []


def report_account_scan(
    username: str, new_count: int, error: str | None = None
) -> None:
    """스캔 결과를 서버에 보고 (last_scanned_at 등 업데이트)"""
    if not API_TOKEN:
        return
    body = {"username": username, "new_count": new_count}
    if error:
        body["error"] = error[:500]
    try:
        requests.post(
            f"{API_URL}/api/admin/accounts/report",
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
    except requests.RequestException as e:
        print(f"    ⚠️ 스캔 보고 실패: {e}")


def push_urls_to_queue(urls: list[str]) -> dict:
    """발견된 URL 목록을 큐에 추가 (이미 있는 건 서버에서 자동 스킵)"""
    if not API_TOKEN or not urls:
        return {"ok": False, "error": "no token or empty"}
    try:
        r = requests.post(
            f"{API_URL}/api/admin/queue/add",
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={"urls": urls},
            timeout=30,
        )
        return r.json()
    except requests.RequestException as e:
        return {"ok": False, "error": str(e)}


def scan_one_account(username: str, recent: int) -> tuple[list[str], str | None]:
    """
    한 계정의 최근 N개 게시물 URL 추출 (gallery-dl --simulate)
    이미지 다운 X. JSON 메타만 stdout 으로 받음.
    반환: (urls, error_message_or_None)

    중요:
      - URL 은 반드시 /posts/ 까지 줘야 함 (그래야 개별 post 메타 추출)
      - gallery-dl -j 출력은 indented JSON 한 덩어리 (줄 단위 X)
        구조: [[type, ...], [type, ...], ...] — type=2 가 post 메타
    """
    url = f"https://www.instagram.com/{username}/posts/"
    cmd = [
        *GALLERY_DL_CMD,
        "--simulate",
        "-j",  # JSON 메타만 stdout
        "--range", f"1-{recent}",
    ]
    if COOKIES_FILE:
        cmd += ["--cookies", COOKIES_FILE]
    elif COOKIES_BROWSER:
        cmd += ["--cookies-from-browser", COOKIES_BROWSER]
    cmd.append(url)

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60,
            encoding="utf-8", errors="replace",
        )
    except subprocess.TimeoutExpired:
        return [], "gallery-dl timeout (60s)"
    except Exception as e:
        return [], f"gallery-dl 실행 오류: {e}"

    if result.returncode != 0:
        err = (result.stderr or "").strip().splitlines()
        last = err[-1] if err else "(에러 메시지 없음)"
        return [], last[:200]

    # gallery-dl -j 출력 = 전체가 하나의 JSON 배열
    # 각 entry = [type:int, url:str?, meta:dict?]
    #   type=2: pre-download (post 메타)
    #   type=3: file (개별 미디어 메타, post_url/post_shortcode 도 포함)
    stdout = (result.stdout or "").strip()
    if not stdout:
        return [], None  # 게시물 0개 (정상 — 신규 계정 등)
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as e:
        return [], f"JSON 파싱 실패: {e}"

    urls: list[str] = []
    seen = set()
    if not isinstance(payload, list):
        return [], None

    for entry in payload:
        if not isinstance(entry, list):
            continue
        # meta dict 는 entry 중 dict 타입인 마지막 요소
        meta = None
        for item in entry:
            if isinstance(item, dict):
                meta = item
        if not meta:
            continue
        # post_url 또는 post_shortcode 에서 추출
        post_url = meta.get("post_url")
        if not post_url:
            shortcode = meta.get("post_shortcode") or meta.get("shortcode")
            if shortcode:
                post_url = f"https://www.instagram.com/p/{shortcode}/"
        if not post_url:
            continue
        if post_url in seen:
            continue
        seen.add(post_url)
        urls.append(post_url)

    return urls, None


def run_scan_mode(recent: int, dry_run: bool) -> int:
    """매일 저녁용: 활성 계정 순회 → 신규 게시물 URL 큐 push (Claude 호출 X)"""
    usernames = fetch_active_usernames()
    if not usernames:
        print("📡 활성 모니터링 계정 0개. /admin/accounts 에서 등록해주세요.")
        return 0

    print(f"🔭 스캔 시작: {len(usernames)}개 계정, 각 최근 {recent}개 게시물")
    print(f"   API: {API_URL}")
    if dry_run:
        print(f"   모드: DRY RUN (큐 추가·서버 보고 X)")
    print()

    total_found = 0
    total_added = 0
    total_failed = 0

    for i, username in enumerate(usernames, 1):
        print(f"[{i}/{len(usernames)}] @{username}")
        urls, err = scan_one_account(username, recent)
        if err:
            print(f"    ⚠ {err}")
            total_failed += 1
            if not dry_run:
                report_account_scan(username, 0, err)
        else:
            print(f"    📡 게시물 {len(urls)}개 메타 fetch")
            total_found += len(urls)
            if urls and not dry_run:
                push = push_urls_to_queue(urls)
                if push.get("ok"):
                    added = push.get("added", 0)
                    total_added += added
                    if added > 0:
                        print(f"    ✨ 큐 추가: {added}개 신규 (나머지는 이미 있음)")
                    else:
                        print(f"    · 신규 없음 (모두 이미 등록)")
                    report_account_scan(username, added, None)
                else:
                    print(f"    ❌ 큐 push 실패: {push.get('error')}")
                    report_account_scan(username, 0, push.get("error"))
            elif urls and dry_run:
                for u in urls:
                    print(f"      · {u}")

        if i < len(usernames) and SLEEP_BETWEEN_URLS > 0:
            import time
            time.sleep(SLEEP_BETWEEN_URLS)

    print()
    print(f"✅ 스캔 완료: 게시물 {total_found}개 fetch, "
          f"큐 신규 추가 {total_added}개, 실패 {total_failed}계정")
    print(f"   처리 시작: py ingest.py --pull --limit 10")
    return 0


def run_file_mode(file_path: Path, dry_run: bool) -> int:
    """기존 모드: urls.txt 파일에서 읽어서 처리 (큐 미경유)"""
    urls = parse_urls(file_path)
    if not urls:
        print("❌ 처리할 URL 없음")
        return 1

    print(f"📋 {len(urls)}개 URL 처리 시작 (파일 모드)")
    print(f"   API: {API_URL}")
    if dry_run:
        print(f"   모드: DRY RUN (다운만, API 호출 X)")
    print()

    counts = {"created": 0, "duplicate": 0, "failed": 0}
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] {url}")
        status = process_url(url, queue_id=None, dry_run=dry_run)
        counts[status] += 1
        if i < len(urls) and SLEEP_BETWEEN_URLS > 0:
            import time
            time.sleep(SLEEP_BETWEEN_URLS)

    print()
    print(f"✅ 완료: {counts['created']}개 생성, {counts['duplicate']}개 중복, "
          f"{counts['failed']}개 실패")
    print(f"   검수: {API_URL}/admin/queue")
    return 0 if counts["failed"] == 0 else 2


def run_pull_mode(limit: int, dry_run: bool) -> int:
    """폴링 모드: 서버 큐에서 todo N개 fetch → 처리 → 결과 보고"""
    print(f"📡 큐 pull (limit={limit})")
    print(f"   API: {API_URL}")

    items = pull_from_queue(limit)
    if not items:
        print("   대기 큐 비어있음. 정상 종료.")
        return 0

    print(f"   가져온 항목: {len(items)}개")
    if dry_run:
        print(f"   모드: DRY RUN (다운만, 완료 보고 X)")
    print()

    counts = {"created": 0, "duplicate": 0, "failed": 0}
    for i, item in enumerate(items, 1):
        url = item["url"]
        queue_id = item["id"]
        print(f"[{i}/{len(items)}] {url}")
        status = process_url(url, queue_id=None if dry_run else queue_id,
                             dry_run=dry_run)
        counts[status] += 1
        if i < len(items) and SLEEP_BETWEEN_URLS > 0:
            import time
            time.sleep(SLEEP_BETWEEN_URLS)

    print()
    print(f"✅ 완료: {counts['created']}개 생성, {counts['duplicate']}개 중복, "
          f"{counts['failed']}개 실패")
    print(f"   검수: {API_URL}/admin/queue")
    return 0 if counts["failed"] == 0 else 2


def main() -> int:
    parser = argparse.ArgumentParser(
        description="인스타 게시물 URL 일괄 → 엄빠레이더 pending 카드 등록"
    )
    parser.add_argument(
        "file",
        type=Path,
        nargs="?",
        help="URL 목록 텍스트 파일 (파일 모드). --pull 사용 시 생략",
    )
    parser.add_argument(
        "--pull",
        action="store_true",
        help="서버 ingest_queue 에서 todo N개 fetch → 처리 (작업 스케줄러 모드)",
    )
    parser.add_argument(
        "--scan",
        action="store_true",
        help="활성 인스타 계정 순회 → 신규 게시물 URL 만 큐에 push (Claude 호출 X)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="--pull 모드에서 한 번에 가져올 개수 (기본 5, 최대 20)",
    )
    parser.add_argument(
        "--recent",
        type=int,
        default=5,
        help="--scan 모드에서 각 계정 최근 N개 게시물 검사 (기본 5)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="다운만 하고 API POST 안 함 (테스트용)",
    )
    args = parser.parse_args()

    if not API_TOKEN:
        print("⚠️  .env에 ADMIN_CLI_TOKEN 설정 필요 (.env.example 참조)")
        return 1

    if args.scan:
        return run_scan_mode(
            recent=min(max(args.recent, 1), 20),
            dry_run=args.dry_run,
        )

    if args.pull:
        return run_pull_mode(limit=min(max(args.limit, 1), 20),
                             dry_run=args.dry_run)

    if not args.file:
        parser.error("파일 인자 또는 --pull / --scan 중 하나가 필요해요.")

    return run_file_mode(args.file, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())

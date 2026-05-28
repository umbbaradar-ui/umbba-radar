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

    # 이미지 없음 = 영상(Reel) 게시물일 가능성
    # gallery-dl 메타에 display_url (썸네일 URL) 이 들어있어 직접 다운
    if not image_files and metadata_files:
        for meta_file in metadata_files:
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                # display_url 또는 thumbnail_src · video_thumbnail_url 등 후보
                thumb_url = (
                    meta.get("display_url")
                    or meta.get("thumbnail_src")
                    or meta.get("video_thumbnail_url")
                    or meta.get("thumbnail_url")
                )
                if thumb_url:
                    try:
                        r = requests.get(thumb_url, timeout=30)
                        if r.status_code == 200:
                            thumb_path = work_dir / "video-thumbnail.jpg"
                            thumb_path.write_bytes(r.content)
                            image_files = [thumb_path]
                            print(f"    🎬 영상 게시물 — 썸네일 별도 다운 OK")
                            break
                    except Exception as e:
                        print(f"    ⚠ 썸네일 다운 실패: {e}")
            except Exception:
                continue

    if not image_files:
        print("    ❌ 다운된 이미지·썸네일 없음 (비공개·삭제·메타 형식 변경)")
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
            elif status == "skipped":
                reason = result.get("reason", "AI 가 노이즈로 판단")
                ai = result.get("ai", {})
                title = ai.get("title", "")
                print(f"    🚫 skip — {reason}")
                if title:
                    print(f"       (검토용: \"{title[:50]}\")")
                if queue_id:
                    report_complete(queue_id, "failed", error=f"AI skip: {reason}")
                return "duplicate"  # 통계상 처리됨으로 (실패 X)
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


def push_urls_to_queue(items: list[dict]) -> dict:
    """발견된 게시물 메타를 큐에 추가 (이미 있는 건 서버에서 자동 스킵)
    items[i] = { url, source_username?, source_post_date?, caption_preview? }"""
    if not API_TOKEN or not items:
        return {"ok": False, "error": "no token or empty"}
    try:
        r = requests.post(
            f"{API_URL}/api/admin/queue/add",
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={"urls": items},
            timeout=30,
        )
        return r.json()
    except requests.RequestException as e:
        return {"ok": False, "error": str(e)}


def scan_one_account(username: str, recent: int) -> tuple[list[dict], str | None]:
    """
    한 계정의 최근 N개 게시물 메타 추출 (gallery-dl --simulate)
    이미지 다운 X. JSON 메타만 stdout 으로 받음.
    반환: (items, error_message_or_None)
      items[i] = { url, source_username, source_post_date, caption_preview }

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

    items: list[dict] = []
    seen = set()
    if not isinstance(payload, list):
        return [], None

    for entry in payload:
        if not isinstance(entry, list):
            continue
        # gallery-dl 는 에러를 [-1, {error, message}] 형태로 반환
        # 예: HttpError 400 (쿠키 만료·차단), Login required, 비공개 등
        if len(entry) >= 2 and entry[0] == -1 and isinstance(entry[1], dict):
            err = entry[1]
            err_type = err.get("error", "Unknown")
            err_msg = err.get("message", "")
            return [], f"{err_type}: {err_msg}"[:200]

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

        # 미리보기 메타 추출
        description = meta.get("description") or ""
        post_date_raw = meta.get("post_date") or meta.get("date") or None
        # gallery-dl 의 post_date 는 "YYYY-MM-DD HH:MM:SS" 형식 (UTC).
        # KST 기준으로 변환하려면 +09:00 더해야 하지만, 인스타가 이미 사용자 로컬 시간으로
        # 줄 가능성 있어 일단 그대로 ISO 변환 (Postgres timestamptz 가 자동 처리)
        post_date_iso = None
        if isinstance(post_date_raw, str) and post_date_raw:
            try:
                # "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ"
                post_date_iso = post_date_raw.replace(" ", "T") + "Z"
            except Exception:
                post_date_iso = None

        items.append({
            "url": post_url,
            "source_username": username,
            "source_post_date": post_date_iso,
            # 캡션은 마감일·당첨자 발표 후반부 정보까지 보존하려 2000자
            # (DB 컬럼·UI 도 동일 정책)
            "caption_preview": description[:2000] if description else None,
        })

    return items, None


def run_scan_mode(recent: int, dry_run: bool, max_accounts: int = 30) -> int:
    """매일 저녁용: 활성 계정 순회 → 신규 게시물 URL 큐 push (Claude 호출 X)"""
    all_usernames = fetch_active_usernames()
    if not all_usernames:
        print("📡 활성 모니터링 계정 0개. /admin/accounts 에서 등록해주세요.")
        return 0

    # 인스타 봇 감지 완화 — 한 번에 max_accounts 까지만.
    # listActiveUsernames 가 last_scanned_at nullsFirst·오래된 것부터 정렬해서 반환하므로
    # 자연스럽게 며칠 사이클로 모든 계정 다 돌게 됨.
    if len(all_usernames) > max_accounts:
        print(f"⚠️  총 {len(all_usernames)}개 활성 계정 중 {max_accounts}개만 이번 회차 처리 (봇 의심 완화)")
        print(f"   (last_scanned_at 오래된 순서. 다음 회차에 나머지 자동 우선 처리)")
        usernames = all_usernames[:max_accounts]
    else:
        usernames = all_usernames

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
        try:
            items, err = scan_one_account(username, recent)
        except Exception as e:
            import traceback
            tb = traceback.format_exc().splitlines()
            last_line = tb[-1] if tb else str(e)
            print(f"    💥 예외 발생: {last_line}")
            total_failed += 1
            if not dry_run:
                try:
                    report_account_scan(username, 0, f"unhandled: {last_line}"[:500])
                except Exception:
                    pass
            # 다음 계정 계속 진행
            if i < len(usernames) and SLEEP_BETWEEN_URLS > 0:
                import time
                time.sleep(SLEEP_BETWEEN_URLS)
            continue

        if err:
            print(f"    ⚠ {err}")
            total_failed += 1
            if not dry_run:
                report_account_scan(username, 0, err)
        else:
            print(f"    📡 게시물 {len(items)}개 메타 fetch")
            total_found += len(items)
            if items and not dry_run:
                push = push_urls_to_queue(items)
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
            elif items and dry_run:
                for it in items:
                    caption = (it.get("caption_preview") or "").replace("\n", " ")[:60]
                    print(f"      · {it['url']}  {caption}")

        if i < len(usernames) and SLEEP_BETWEEN_URLS > 0:
            import time
            time.sleep(SLEEP_BETWEEN_URLS)

    print()
    print(f"✅ 스캔 완료: 게시물 {total_found}개 fetch, "
          f"큐 신규 추가 {total_added}개, 실패 {total_failed}계정")
    print(f"   처리 시작: py ingest.py --pull --limit 10")
    return 0


# ============================================
# --export-todo 모드 — 로컬 분석 (Claude Code) 용 JSON export
# 큐의 todo 항목들 + (옵션) 이미지를 Storage 에 업로드한 영구 URL
# 결과: ./exports/todo-YYYYMMDD-HHMM.json
# ============================================

def fetch_export_todo() -> dict | None:
    """서버에서 todo 큐 export JSON 가져옴 (어드민 cookie 인증)
    CLI 에서 ADMIN_CLI_TOKEN Bearer 로 대신 인증할 수 있게 별도 endpoint 가
    더 깔끔하나, 일단 todo 만 fetch 하는 우회로: pull endpoint 대신 별도 GET 사용

    여기선 ADMIN_CLI_TOKEN 으로 인증되는 별도 endpoint 가 필요한데, export-todo
    는 어드민 cookie 만 받음. 단순화를 위해 CLI 는 직접 큐 API 안 호출하고
    사용자가 웹에서 [Export] 버튼으로 받은 파일을 CLI 에 path 로 줘서 처리
    하는 방향이 더 안전.

    이 함수는 placeholder. --export-todo 모드는 사용자가 받은 파일 경로를
    --input 로 주는 방식으로 동작.
    """
    return None


def upload_image_to_storage(image_path: Path) -> str | None:
    """로컬 이미지 → Supabase Storage 업로드 → 영구 URL"""
    if not API_TOKEN:
        return None
    try:
        image_bytes = image_path.read_bytes()
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        ext = image_path.suffix.lower().lstrip(".")
        mime = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp",
            "gif": "image/gif",
        }.get(ext, "image/jpeg")
        r = requests.post(
            f"{API_URL}/api/admin/upload-image",
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={"image_base64": image_b64, "image_mime": mime},
            timeout=60,
        )
        data = r.json()
        if data.get("ok"):
            return data.get("url")
        return None
    except Exception as e:
        print(f"      ⚠ 이미지 업로드 실패: {e}")
        return None


def fetch_export_todo_via_api() -> dict | None:
    """서버 API 에서 todo 큐 JSON 받아옴 (Bearer 인증).
    웹 [Export todo JSON] 버튼이 다운로드해주는 것과 동일한 데이터."""
    if not API_TOKEN:
        print("❌ ADMIN_CLI_TOKEN 미설정")
        return None
    try:
        r = requests.get(
            f"{API_URL}/api/admin/queue/export-todo",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            timeout=60,
        )
    except requests.RequestException as e:
        print(f"❌ export-todo 네트워크 오류: {e}")
        return None
    if r.status_code != 200:
        print(f"❌ export-todo HTTP {r.status_code}: {r.text[:200]}")
        return None
    try:
        return r.json()
    except Exception as e:
        print(f"❌ export-todo 응답 파싱 실패: {e}")
        return None


def _process_export(
    payload: dict,
    with_images: bool,
    output_dir: Path,
    source_label: str,
) -> int:
    """공통 export 로직: payload (dict) 받아서 이미지 다운/업로드 + JSON 저장"""
    items = payload.get("items", []) if isinstance(payload, dict) else payload
    if not isinstance(items, list) or not items:
        print("❌ items 배열 없음 또는 비어있음")
        return 1

    # 출력 폴더 (timestamp)
    ts = __import__("datetime").datetime.now().strftime("%Y-%m-%d-%H%M")
    work_dir = output_dir / ts
    images_dir = work_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    print(f"📦 export 시작: {len(items)}개 항목 → {work_dir}")
    print(f"   입력: {source_label}")
    if with_images:
        print(f"   이미지 다운 + Storage 업로드 모드 (C)")
    else:
        print(f"   텍스트만 (A 모드)")
    print()

    enriched = []
    for i, item in enumerate(items, 1):
        url = item.get("url")
        queue_id = item.get("queue_id")
        if not url:
            continue
        username = item.get("source_username") or "unknown"
        print(f"[{i}/{len(items)}] @{username}  {url}")

        enriched_item = dict(item)  # shallow copy

        if with_images:
            # gallery-dl 로 이미지 다운로드
            with tempfile.TemporaryDirectory(prefix="umbba-export-") as tmp:
                tmp_dir = Path(tmp)
                post = download_post(url, tmp_dir)
                if post:
                    # 로컬에 영구 보존 (Claude Code 가 분석할 수 있게)
                    local_dest = images_dir / f"{queue_id or i}{post['image_path'].suffix}"
                    local_dest.write_bytes(post["image_path"].read_bytes())
                    enriched_item["caption_full"] = post["caption"]
                    enriched_item["local_image_path"] = str(local_dest.relative_to(work_dir))
                    print(f"    📥 이미지 {local_dest.stat().st_size // 1024}KB → {local_dest.name}")

                    # Storage 업로드 → 영구 URL
                    storage_url = upload_image_to_storage(local_dest)
                    if storage_url:
                        enriched_item["thumbnail_url"] = storage_url
                        print(f"    ☁️ Storage 업로드 OK")
                    else:
                        print(f"    ⚠ Storage 업로드 실패 — 로컬 path 만 사용")
                else:
                    print(f"    ⚠ 이미지 다운 실패 — 텍스트만 진행")

        enriched.append(enriched_item)

        if i < len(items) and SLEEP_BETWEEN_URLS > 0:
            import time
            time.sleep(SLEEP_BETWEEN_URLS)

    # 결과 JSON 저장
    output_file = work_dir / "todo-enriched.json"
    output_payload = {
        **(payload if isinstance(payload, dict) else {}),
        "items": enriched,
        "enriched_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat().replace("+00:00", "Z"),
        "with_images": with_images,
    }
    output_file.write_text(
        json.dumps(output_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print()
    print(f"✅ export 완료")
    print(f"   파일: {output_file}")
    if with_images:
        print(f"   이미지: {images_dir}")
    print()
    print(f"💡 다음: Claude Code 에서")
    print(f'   "{output_file.name} 의 항목들 RULES.md 보고 분류해줘 → results.json"')
    print(f'   그 다음: py ingest.py --import results.json')
    return 0


def run_export_from_mode(
    input_json: Path,
    with_images: bool,
    output_dir: Path,
) -> int:
    """파일 입력 모드 (--export-from <file>)"""
    if not input_json.exists():
        print(f"❌ 입력 파일 없음: {input_json}")
        return 1
    try:
        payload = json.loads(input_json.read_text(encoding="utf-8-sig"))
    except Exception as e:
        print(f"❌ JSON 파싱 실패: {e}")
        return 1
    return _process_export(payload, with_images, output_dir, str(input_json))


def run_auto_export_mode(with_images: bool, output_dir: Path) -> int:
    """API 자동 호출 모드 (--auto-export)
    서버에서 todo 큐 받아 → 이미지 처리 → JSON 저장. 사용자 손 없음."""
    print(f"📡 서버에서 todo 큐 fetch (Bearer)")
    payload = fetch_export_todo_via_api()
    if payload is None:
        return 1
    count = payload.get("count", 0)
    if count == 0:
        print("   todo 0개. 처리할 게 없어요.")
        return 0
    print(f"   가져온 항목: {count}개")
    return _process_export(payload, with_images, output_dir, f"API ({API_URL})")


def run_import_mode(results_file: Path) -> int:
    """Claude Code 가 만든 results.json 업로드 → posts 카드 일괄 생성

    skip=false + thumbnail_url 없는 항목은 자동으로:
      - 큐 항목의 source_url 조회 (API)
      - gallery-dl 로 이미지 다운로드 (인스타 호출)
      - Supabase Storage 업로드
      - thumbnail_url 채워서 import

    인스타 호출은 진짜 모집 (skip=false) 만 → 부담 최소화.
    """
    if not results_file.exists():
        print(f"❌ 결과 파일 없음: {results_file}")
        return 1
    if not API_TOKEN:
        print("❌ ADMIN_CLI_TOKEN 미설정")
        return 1
    try:
        payload = json.loads(results_file.read_text(encoding="utf-8-sig"))
    except Exception as e:
        print(f"❌ JSON 파싱 실패: {e}")
        return 1

    items = payload.get("items", []) if isinstance(payload, dict) else payload
    if not isinstance(items, list) or not items:
        print("❌ items 배열 없음 또는 비어있음")
        return 1

    print(f"📤 import 시작: {len(items)}개 항목")
    print(f"   API: {API_URL}")

    # skip=false + thumbnail_url 없는 항목이 있으면 큐 URL 매핑 한 번 받음
    needs_image = [
        it for it in items
        if not it.get("skip") and not it.get("thumbnail_url")
    ]
    queue_url_map: dict[str, str] = {}
    if needs_image:
        print(f"   이미지 다운 필요: {len(needs_image)}개 (skip=false + 썸네일 X)")
        print(f"   큐 URL 매핑 fetch …")
        todo_payload = fetch_export_todo_via_api()
        if todo_payload:
            for ti in todo_payload.get("items", []):
                qid = ti.get("queue_id")
                url = ti.get("url")
                if qid and url:
                    queue_url_map[qid] = url

        # 이미지 자동 다운 + 업로드
        print()
        for idx, item in enumerate(needs_image, 1):
            qid = item.get("queue_id")
            url = queue_url_map.get(qid)
            if not url:
                print(f"  [{idx}/{len(needs_image)}] {qid[:8]}… ⚠ 큐에 url 없음, 썸네일 NULL 로 진행")
                continue

            print(f"  [{idx}/{len(needs_image)}] {url}")
            with tempfile.TemporaryDirectory(prefix="umbba-import-") as tmp:
                post = download_post(url, Path(tmp))
                if not post:
                    print(f"    ⚠ 이미지 다운 실패 — 썸네일 NULL")
                else:
                    storage_url = upload_image_to_storage(post["image_path"])
                    if storage_url:
                        item["thumbnail_url"] = storage_url
                        print(f"    ☁️ Storage 업로드 OK")
                    else:
                        print(f"    ⚠ Storage 업로드 실패 — 썸네일 NULL")

            if idx < len(needs_image) and SLEEP_BETWEEN_URLS > 0:
                import time
                time.sleep(SLEEP_BETWEEN_URLS)

        # 다음 단계 안내 / 결과 파일 백업 (썸네일 URL 채워진 상태)
        backup_file = results_file.with_suffix(".with-images.json")
        try:
            backup_file.write_text(
                json.dumps(
                    {**payload, "items": items, "enriched_with_images_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat().replace("+00:00", "Z")},
                    ensure_ascii=False, indent=2
                ),
                encoding="utf-8",
            )
            print(f"\n   썸네일 URL 추가본 저장: {backup_file}")
        except Exception:
            pass

    print()

    # 200개 단위 청크로 분할 (서버 endpoint 제한과 일치)
    CHUNK = 200
    total_created = 0
    total_skipped = 0
    total_failed = 0
    all_errors = []

    for offset in range(0, len(items), CHUNK):
        chunk = items[offset:offset + CHUNK]
        try:
            r = requests.post(
                f"{API_URL}/api/admin/queue/import-results",
                headers={
                    "Authorization": f"Bearer {API_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={"items": chunk},
                timeout=90,
            )
        except requests.RequestException as e:
            print(f"❌ 청크 {offset // CHUNK + 1} 네트워크 오류: {e}")
            total_failed += len(chunk)
            continue

        if r.status_code != 200:
            print(f"❌ HTTP {r.status_code}: {r.text[:200]}")
            total_failed += len(chunk)
            continue

        data = r.json()
        if not data.get("ok"):
            print(f"❌ {data.get('error', 'unknown')}")
            total_failed += len(chunk)
            continue

        created = data.get("created", 0)
        skipped = data.get("skipped", 0)
        failed = data.get("failed", 0)
        total_created += created
        total_skipped += skipped
        total_failed += failed
        all_errors.extend(data.get("errors", []))

        print(f"   청크 {offset // CHUNK + 1}: 생성 {created}, 스킵 {skipped}, 실패 {failed}")

    print()
    print(f"✅ import 완료")
    print(f"   카드 생성: {total_created}개")
    print(f"   스킵 (skip true · 중복): {total_skipped}개")
    print(f"   실패: {total_failed}개")
    if all_errors:
        print(f"   실패 상세 (최대 20개):")
        for e in all_errors[:20]:
            print(f"     · {e.get('queue_id', '?')[:8]}: {e.get('message', '')[:100]}")
    print()
    print(f"   검수: {API_URL}/admin/queue")
    return 0 if total_failed == 0 else 2


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
        default=3,
        help="--scan 모드에서 각 계정 최근 N개 게시물 검사 (기본 3, 봇 의심 완화)",
    )
    parser.add_argument(
        "--max-accounts",
        type=int,
        default=30,
        help="--scan 1회당 최대 계정 수 (기본 30). last_scanned_at 오래된 것부터. 인스타 봇 감지 완화. 한 번에 다 돌리려면 --max-accounts 200",
    )
    parser.add_argument(
        "--export-from",
        type=Path,
        help="로컬 분석 export 모드 (파일 입력): 웹 [Export] 로 받은 todo-*.json 경로",
    )
    parser.add_argument(
        "--auto-export",
        action="store_true",
        help="로컬 분석 export 모드 (API 자동): 서버 큐에서 todo 자동 fetch → 이미지 처리 → JSON 저장",
    )
    parser.add_argument(
        "--with-images",
        action="store_true",
        help="--export-from / --auto-export 와 함께: 이미지도 다운 + Storage 업로드 (C 모드)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("./exports"),
        help="export 결과 저장 폴더 (기본 ./exports)",
    )
    parser.add_argument(
        "--import",
        dest="import_file",
        type=Path,
        help="Claude Code 가 만든 results.json 업로드 → 카드 자동 생성",
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
            max_accounts=min(max(args.max_accounts, 1), 200),
        )

    if args.auto_export:
        return run_auto_export_mode(
            with_images=args.with_images,
            output_dir=args.output_dir,
        )

    if args.export_from:
        return run_export_from_mode(
            input_json=args.export_from,
            with_images=args.with_images,
            output_dir=args.output_dir,
        )

    if args.import_file:
        return run_import_mode(args.import_file)

    if args.pull:
        return run_pull_mode(limit=min(max(args.limit, 1), 20),
                             dry_run=args.dry_run)

    if not args.file:
        parser.error(
            "파일 인자 또는 --pull / --scan / --auto-export / --export-from / --import 중 하나가 필요해요."
        )

    return run_file_mode(args.file, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())

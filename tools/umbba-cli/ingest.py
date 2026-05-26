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
    """파일에서 URL 목록 — 줄바꿈, 주석(#) 제외"""
    if not file_path.exists():
        print(f"❌ 파일이 없어요: {file_path}")
        sys.exit(1)
    urls = []
    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="인스타 게시물 URL 일괄 → 엄빠레이더 draft 등록"
    )
    parser.add_argument("file", type=Path, help="URL 목록 텍스트 파일")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="다운만 하고 API POST 안 함 (테스트용)",
    )
    args = parser.parse_args()

    if not API_TOKEN:
        print("⚠️  .env에 ADMIN_CLI_TOKEN 설정 필요 (.env.example 참조)")
        return 1

    urls = parse_urls(args.file)
    if not urls:
        print("❌ 처리할 URL 없음")
        return 1

    print(f"📋 {len(urls)}개 URL 처리 시작")
    print(f"   API: {API_URL}")
    if args.dry_run:
        print(f"   모드: DRY RUN (다운만, API 호출 X)")
    print()

    success = 0
    duplicate = 0
    failed = 0

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] {url}")

        # 각 URL마다 임시 작업 폴더 (다운 후 정리)
        with tempfile.TemporaryDirectory(prefix="umbba-") as tmp:
            work_dir = Path(tmp)

            post = download_post(url, work_dir)
            if not post:
                failed += 1
                continue

            print(
                f"    📥 이미지 {post['image_path'].stat().st_size // 1024}KB "
                f"+ 캡션 {len(post['caption'])}자"
            )

            if args.dry_run:
                success += 1
                continue

            result = upload_to_api(url, post)
            if result.get("ok"):
                status = result.get("status", "created")
                if status == "duplicate":
                    print(f"    🔁 중복 (post_id={result.get('post_id')[:8]}...)")
                    duplicate += 1
                else:
                    ai = result.get("ai", {})
                    title = ai.get("title", "(분류 실패)")
                    conf = ai.get("confidence", 0)
                    print(
                        f"    ✅ draft 생성 — \"{title[:40]}\""
                        f"{f' (신뢰도 {conf:.0%})' if conf else ''}"
                    )
                    success += 1
            else:
                print(f"    ❌ {result.get('error', 'unknown error')}")
                failed += 1

        # 다음 URL 전 짧은 sleep (rate limit 회피)
        if i < len(urls) and SLEEP_BETWEEN_URLS > 0:
            import time
            time.sleep(SLEEP_BETWEEN_URLS)

    # 결과 요약
    print()
    print(f"✅ 완료: {success}개 생성, {duplicate}개 중복, {failed}개 실패")
    print(f"   검수: {API_URL}/admin/queue")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())

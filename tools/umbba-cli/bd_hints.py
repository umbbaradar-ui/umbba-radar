#!/usr/bin/env python3
"""bd_hints.py — 카드뉴스 이미지 속 글자(BD alt_text)에서 마감·발표 단서를 뽑아 검수에 넘기는 사이드카.

배경(2026-09-21 와이프): 캡션엔 마감이 없고 캐러셀 특정 장에만 "모집기간 9/4~9/20" 이 적힌 게시물이
많다. 텍스트만 보는 분류·검수는 이를 못 보고 마감미정으로 두는데, 그 카드가 노출기간(3/5/7일)으로
발행되면 실제 마감과 어긋난다. 운영자가 이미지를 열어보지 않아도 되게 단서를 note 에 실어준다.

- 수집(bd_urls·bd_ingest)에서 BD 레코드의 post_content[].alt_text(인스타 자동 생성 — 이미지 속 텍스트를
  "texto que dice/text that says '…'" 형태로 담고 있음) 중 날짜·기간 단서가 있는 조각만 골라
  image_hints/<post_id>.json 에 저장.
- 검수(bd_review)가 카드 id 로 읽어 input.json 의 image_text_hint 로 넣는다. REVIEW-RULES.md 참고.
- 서버·DB 는 손대지 않는다(맥 로컬 파일). 14일 지난 파일은 자동 정리.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

DIR = Path(__file__).resolve().parent / "image_hints"
MAX_CHARS = 400
KEEP_DAYS = 14

# alt_text 끝의 인용부 — 언어별 접두("texto que dice", "text that says", "텍스트")는 무시하고 따옴표 안만 뽑는다
_QUOTED = re.compile(r'"([^"]{4,})"')
# 날짜·기간 단서 — 이게 하나도 없으면 힌트로 취급하지 않는다
_DATEISH = re.compile(
    r"(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*[/.]\s*\d{1,2}\s*(?:\(|일|~|-|까지)|마감|발표|모집\s*기간|이벤트\s*기간|참여\s*기간|응모\s*기간|선착순|D-\d)"
)


def extract_texts(rec: dict) -> list[str]:
    """BD 레코드 → 캐러셀 장별 이미지 텍스트(있는 것만, 순서 유지)."""
    out: list[str] = []
    for pc in rec.get("post_content") or []:
        alt = (pc.get("alt_text") or "").strip() if isinstance(pc, dict) else ""
        if not alt:
            continue
        m = _QUOTED.findall(alt)
        txt = " ".join(m) if m else alt
        txt = re.sub(r"\s+", " ", txt).strip()
        if txt:
            out.append(txt)
    if not out:
        alt = (rec.get("alt_text") or "").strip()
        if alt:
            m = _QUOTED.findall(alt)
            out.append(re.sub(r"\s+", " ", " ".join(m) if m else alt).strip())
    return out


def date_hint(texts: list[str]) -> str | None:
    """날짜·기간 단서가 있는 장의 텍스트만 모아 짧게. 없으면 None."""
    picked = []
    for i, t in enumerate(texts, 1):
        if _DATEISH.search(t):
            picked.append(f"[{i}장] {t[:220]}")
    if not picked:
        return None
    s = " / ".join(picked)
    return s[:MAX_CHARS]


def save(post_id: str, rec: dict) -> str | None:
    """레코드에서 힌트를 뽑아 저장. 저장했으면 힌트 문자열, 아니면 None."""
    if not post_id:
        return None
    try:
        hint = date_hint(extract_texts(rec))
        if not hint:
            return None
        DIR.mkdir(exist_ok=True)
        (DIR / f"{post_id}.json").write_text(
            json.dumps({"post_id": post_id, "hint": hint, "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S")},
                       ensure_ascii=False), encoding="utf-8")
        return hint
    except Exception:
        return None


def load(post_id: str) -> str | None:
    try:
        p = DIR / f"{post_id}.json"
        if not p.exists():
            return None
        return (json.loads(p.read_text(encoding="utf-8")).get("hint") or None)
    except Exception:
        return None


def sweep(days: int = KEEP_DAYS) -> int:
    """오래된 사이드카 정리(분류에서 삭제된 카드 것 포함). 지운 개수."""
    if not DIR.exists():
        return 0
    cutoff = time.time() - days * 86400
    n = 0
    for p in DIR.glob("*.json"):
        try:
            if p.stat().st_mtime < cutoff:
                p.unlink(); n += 1
        except Exception:
            pass
    return n

// ============================================
// 인라인 파서 — `**굵게**` · `[문구](url)` 두 가지만 안다
// 원고 변환기(guide_build.py)가 그 밖의 문법을 미리 막으므로 여기선 단순 분해만 한다.
// ============================================

import type { InlineText } from "./types";

export type InlinePart =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string };

const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

export function parseInline(source: InlineText): InlinePart[] {
  const parts: InlinePart[] = [];
  for (const piece of source.split(TOKEN)) {
    if (!piece) continue;
    if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4) {
      parts.push({ kind: "bold", text: piece.slice(2, -2) });
      continue;
    }
    const link = LINK.exec(piece);
    if (link) {
      parts.push({ kind: "link", text: link[1], href: link[2] });
      continue;
    }
    parts.push({ kind: "text", text: piece });
  }
  return parts;
}

/** 마크업을 걷어낸 평문 — JSON-LD·meta 용 */
export function plainText(source: InlineText): string {
  return parseInline(source)
    .map((p) => p.text)
    .join("");
}

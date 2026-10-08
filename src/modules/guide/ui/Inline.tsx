// ============================================
// 인라인 렌더 — **굵게** · [링크](url)
// 내부 링크(/guide/…, /explore…)는 next/link, 외부는 새 창 + noopener
// ============================================

import Link from "next/link";
import { parseInline } from "../inline";
import type { InlineText } from "../types";

const LINK_CLASS =
  "font-semibold text-rose-700 underline decoration-rose-300 underline-offset-2 hover:decoration-rose-500";

export function Inline({ text }: { text: InlineText }) {
  return (
    <>
      {parseInline(text).map((part, i) => {
        if (part.kind === "bold") {
          return (
            <strong key={i} className="font-bold text-slate-900">
              {part.text}
            </strong>
          );
        }
        if (part.kind === "link") {
          if (part.href.startsWith("/")) {
            return (
              <Link key={i} href={part.href} className={LINK_CLASS}>
                {part.text}
              </Link>
            );
          }
          return (
            <a
              key={i}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {part.text}
              <span className="sr-only"> (새 창)</span>
            </a>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </>
  );
}

// ============================================
// 가이드 본문 블록 렌더러
// 블록 형식은 ../types.ts GuideBlock — 원고 md 문법과 1:1
// 표는 모바일(390px)에서 가로 스크롤, 첫 열은 줄바꿈 최소화
// ============================================

import type { GuideBlock } from "../types";
import { Inline } from "./Inline";

export function GuideBody({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className="space-y-4 break-keep text-[15px] leading-7 text-slate-700">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2
          id={block.id}
          className="scroll-mt-24 pt-6 text-lg font-extrabold leading-snug tracking-tight text-slate-900"
        >
          <Inline text={block.text} />
        </h2>
      );
    case "h3":
      return (
        <h3 className="pt-2 text-base font-bold leading-snug text-slate-900">
          <Inline text={block.text} />
        </h3>
      );
    case "p":
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
    case "ul":
      return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-rose-300">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal space-y-1.5 pl-5 marker:font-bold marker:text-rose-500">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );
    case "check":
      return (
        <ul className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-1 inline-block h-4 w-4 shrink-0 rounded border-2 border-rose-300 bg-white"
              />
              <span>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[20rem] border-collapse overflow-hidden rounded-xl bg-white text-left text-sm ring-1 ring-slate-200">
            <thead className="bg-rose-50 text-slate-900">
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="whitespace-nowrap border-b border-rose-100 px-3 py-2 font-bold"
                  >
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-slate-100 last:border-0">
                  {row.map((cell, c) =>
                    c === 0 ? (
                      <th
                        key={c}
                        scope="row"
                        className="px-3 py-2 align-top font-semibold text-slate-900"
                      >
                        <Inline text={cell} />
                      </th>
                    ) : (
                      <td key={c} className="px-3 py-2 align-top">
                        <Inline text={cell} />
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 ring-1 ring-amber-200">
          <Inline text={block.text} />
        </p>
      );
  }
}

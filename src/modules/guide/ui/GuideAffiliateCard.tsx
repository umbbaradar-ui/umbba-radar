"use client";

// ============================================
// 가이드 제휴(체크리스트) 카드 — /guide/[slug] 본문 다음·FAQ 앞
//
// 디자인·이벤트 정본: work 30-umbba/엄빠레이더/수익화/시안-출산준비물-제휴카드.html (C205)
// - 제휴 링크가 1개라도 있으면: 맨 위 '광고' 배지 + 수수료 고지 1줄(항상 보임), 링크 rel="sponsored noopener"
// - 제휴 링크가 없으면(가입·승인 전): '체크리스트 전용' — 광고 배지·고지·가격 보기 버튼 없음
// - 안전 품목은 제휴 링크 없이 '인증 조회'(제품안전정보센터)만
// - 체크 상태는 이 기기 localStorage(umbba_prep_{slug})만. 로그인·DB 없음
// 이벤트(track → /api/track, 마이그레이션 불필요):
//   aff_impression {slug, slot, mode}   카드 50% 노출 시 1회
//   aff_click      {slug, item, partner} 가격 보기
//   prep_check     {slug, item, checked} 체크/해제
//   prep_safety_click {slug, item}      안전 품목 인증 조회
// 카드가 붙는 편과 품목·제목·안내 문구는 affiliate.ts 의 slug 별 데이터(C225: 3편)가 정한다.
// ============================================

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { track } from "@/modules/analytics/service";
import {
  AFFILIATE_GROUP_LABELS,
  AFFILIATE_GROUP_ORDER,
  DEFAULT_AFFILIATE_LEAD,
  DEFAULT_AFFILIATE_TITLE,
  DEFAULT_SAFETY_NOTE,
  SAFETY_CHECK_URL,
  affiliateHref,
  hasAffiliateLinks,
  type GuideAffiliate,
} from "@/modules/guide/affiliate";

const SLOT = "guide_affiliate";
const CHANGE_EVENT = "umbba-prep-change";

type Checked = Record<string, boolean>;

function storageKey(slug: string) {
  return `umbba_prep_${slug}`;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseChecked(raw: string | null): Checked {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Checked) : {};
  } catch {
    return {};
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function GuideAffiliateCard({ data }: { data: GuideAffiliate }) {
  const { slug, partner, items } = data;
  const title = data.title ?? DEFAULT_AFFILIATE_TITLE;
  const lead = data.lead ?? DEFAULT_AFFILIATE_LEAD;
  const key = storageKey(slug);
  const sponsored = hasAffiliateLinks(data);
  const mode = sponsored ? "affiliate" : "checklist";

  // 서버 렌더는 빈 체크로, 하이드레이션 뒤 localStorage 값으로 바뀐다(불일치 경고 없음).
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null
  );
  const checked = useMemo(() => parseChecked(raw), [raw]);
  const done = items.filter((i) => checked[i.id]).length;

  const ref = useRef<HTMLElement>(null);
  const seen = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (seen.current) return;
        if (entries.some((e) => e.isIntersecting)) {
          seen.current = true;
          track("aff_impression", { slug, slot: SLOT, mode });
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [slug, mode]);

  function toggle(id: string, next: boolean) {
    const updated = { ...parseChecked(readRaw(key)), [id]: next };
    try {
      window.localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // 저장 불가(사파리 개인정보 모드 등) — 이번 화면에서만 반영 안 됨
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    track("prep_check", { slug, item: id, checked: next });
  }

  const titleId = `prep-title-${slug}`;

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      data-slot={SLOT}
      data-guide={slug}
      data-mode={mode}
      className="mt-10 overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] ring-1 ring-rose-100"
    >
      {sponsored && (
        <div
          role="note"
          className="flex items-start gap-2 bg-amber-100 px-3.5 py-2.5 text-[12.5px] leading-normal text-amber-800"
        >
          <span className="mt-px shrink-0 rounded-full bg-amber-800 px-[7px] py-0.5 text-[11px] font-extrabold text-white">
            광고
          </span>
          <span>
            이 카드의 <b>가격 보기</b> 링크로 사면 엄빠레이더가 판매 수수료를 받아요. 사는 분이
            내는 값은 같아요.
          </span>
        </div>
      )}

      <div className="px-4 pb-1.5 pt-3.5">
        <h2 id={titleId} className="text-[17px] font-extrabold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-normal text-slate-500">{lead}</p>
      </div>

      <div className="flex items-center gap-2.5 px-4 pb-1 pt-2" aria-live="polite">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
          aria-label="준비물 체크 진행"
        >
          <div
            className="h-full rounded-full bg-rose-400 transition-[width] duration-200"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
        <span className="min-w-11 text-right text-xs font-bold text-rose-700" data-testid="prep-count">
          {done} / {items.length}
        </span>
      </div>

      {AFFILIATE_GROUP_ORDER.map((group) => {
        const rows = items.filter((i) => i.group === group);
        if (rows.length === 0) return null;
        const gid = `prep-${slug}-${group}`;
        const isSafety = group === "safety";
        // 그룹 전체가 링크 없는 품목(안전·noLink)이면 제휴 모드에서 '광고 링크 없음'을 붙인다
        const noAdGroup = rows.every((i) => i.safety || i.noLink);
        const note = data.notes?.[group] ?? (isSafety ? DEFAULT_SAFETY_NOTE : null);
        return (
          <div key={group} role="group" aria-labelledby={gid} className="pb-0.5 pt-1.5">
            <div id={gid} className="px-4 pb-1 pt-2 text-xs font-extrabold text-slate-500">
              {AFFILIATE_GROUP_LABELS[group]}
              {noAdGroup && sponsored && " — 광고 링크 없음"}
            </div>
            {rows.map((item) => {
              const inputId = `prep-${slug}-${item.id}`;
              const isOn = !!checked[item.id];
              const href = affiliateHref(item);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 border-t border-slate-100 px-4 py-2.5"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    data-item={item.id}
                    checked={isOn}
                    onChange={(e) => toggle(item.id, e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-rose-500"
                  />
                  <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                    <span
                      className={`block text-[15px] font-bold ${
                        isOn ? "text-slate-400 line-through" : "text-slate-800"
                      }`}
                    >
                      {item.name}
                    </span>
                    <span className="mt-px block text-xs text-slate-500">{item.qty}</span>
                  </label>
                  {item.safety ? (
                    <a
                      href={SAFETY_CHECK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-item={item.id}
                      onClick={() => track("prep_safety_click", { slug, item: item.id })}
                      className="shrink-0 whitespace-nowrap rounded-[10px] bg-slate-100 px-2.5 py-2 text-[13px] font-bold text-slate-700 active:scale-[0.97]"
                    >
                      인증 조회<span className="sr-only"> (제품안전정보센터, 새 창)</span>
                    </a>
                  ) : (
                    href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="sponsored noopener"
                        data-item={item.id}
                        onClick={() =>
                          track("aff_click", { slug, item: item.id, partner: partner ?? "unknown" })
                        }
                        className="shrink-0 whitespace-nowrap rounded-[10px] bg-rose-50 px-2.5 py-2 text-[13px] font-bold text-rose-700 active:scale-[0.97]"
                      >
                        가격 보기<span className="sr-only"> (광고, 새 창)</span>
                      </a>
                    )
                  )}
                </div>
              );
            })}
            {note && (
              <p className="mx-4 mt-1 rounded-[10px] bg-slate-50 px-3 py-2.5 text-[12.5px] leading-normal text-slate-600">
                {note}
              </p>
            )}
          </div>
        );
      })}

      {sponsored && (
        <p className="mt-2.5 border-t border-slate-100 px-4 pb-3.5 pt-3 text-xs leading-relaxed text-slate-500">
          가격 보기는 특정 제품 추천이 아니라 품목 검색 결과로 연결돼요. 가격·재고는 판매처
          기준이에요.
        </p>
      )}
      {!sponsored && <div className="h-3" aria-hidden />}
    </section>
  );
}

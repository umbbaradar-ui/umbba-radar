// ============================================
// 광고·제휴 안내 — /about/partners (C283)
//
// 누가 보나: 가이드 체크 카드의 '광고' 배지를 보고 궁금한 사용자, 제휴 플랫폼(링크프라이스·네이버 쇼핑
// 커넥트) 매체 심사 담당자. 로그인 없이 열린다(proxy EXEMPT_PREFIXES /about).
//
// 이 페이지는 '보충 설명'이다. 경제적 이해관계 표시는 카드 맨 위(링크 바로 위)에 항상 보인다 —
// 공정위 추천·보증 안내서 p13: 추천 내용과 함께 표시해야 하고, '링크로 연결되는 페이지'는 적절한
// 위치가 아니다. 근거 정리는 src/modules/guide/disclosure.ts 머리 주석.
//
// 문장 정본: src/modules/guide/disclosure.ts (카드 문구와 글자까지 같게 유지).
// 링크 0개(체크리스트 모드)여도 이 페이지의 모든 문장은 사실이다.
// ============================================

import type { Metadata } from "next";
import Link from "next/link";
import {
  AD_BADGE_LABEL,
  CARD_DISCLOSURE,
  CARD_LINK_NOTE,
  NEVER_LINK_GROUPS,
  PARTNER_NAMES,
  PARTNER_NOTICE_POSTED,
  PRIVACY_PARTNER_COOKIE_LINE,
  formatKoreanDate,
  partnerLinksFrom,
} from "@/modules/guide/disclosure";

export const metadata: Metadata = {
  title: "광고·제휴 안내 — 엄빠레이더",
  description:
    "엄빠레이더 가이드의 준비물 체크 카드에 붙는 제휴(광고) 링크가 무엇인지, 어떻게 표시하고 무엇은 링크하지 않는지 안내해요.",
  alternates: { canonical: "/about/partners" },
};

export default function PartnersPage() {
  const partners = Object.keys(PARTNER_NAMES);
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 text-sm leading-relaxed text-slate-700">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">광고·제휴 안내</h1>
        <p className="mt-2 text-xs text-slate-500">
          게시일: {formatKoreanDate(PARTNER_NOTICE_POSTED)} · 제휴 링크는 빨라도{" "}
          {formatKoreanDate(partnerLinksFrom())}부터 붙어요(게시 30일 뒤)
        </p>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          엄빠레이더는 일부 가이드의 <strong>준비물 체크 카드</strong>에 제휴 링크(가격 보기)를 붙일 수
          있어요. 그 링크로 사면 엄빠레이더가 <strong>판매 수수료</strong>를 받아요. 사는 분이 내는
          값은 같아요.
        </p>
      </header>

      <Section title="1. 어디에 붙나요">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>시기별 가이드의 준비물 체크 카드</strong>에만 붙어요(예: 출산 준비물 체크).
          </li>
          <li>
            제휴 링크가 있는 카드는 맨 위에{" "}
            <span className="rounded-full bg-amber-800 px-[7px] py-0.5 text-[11px] font-extrabold text-white">
              {AD_BADGE_LABEL}
            </span>{" "}
            표시와 수수료 안내가 항상 보여요. <strong>이 표시가 없는 카드에는 제휴 링크가 없어요.</strong>
          </li>
          <li>
            홈·탐색의 혜택 카드(지원금·체험단·이벤트)에서 &lsquo;원문 보기&rsquo;는 주최 측 공고로 가는
            링크예요. 제휴 링크가 아니고 수수료도 없어요.
          </li>
        </ul>
      </Section>

      <Section title="2. 카드에 보이는 문구">
        <p className="mb-2">제휴사마다 링크 모양이 달라 문구를 나눴어요. 카드에는 아래 문장이 그대로 보여요.</p>
        <div className="space-y-3">
          {partners.map((p) => (
            <div
              key={p}
              className="rounded-xl border border-slate-200 px-4 py-3"
              data-testid="partner-copy"
              data-partner={p}
            >
              <p className="text-xs font-bold text-slate-900">{PARTNER_NAMES[p]}</p>
              <p className="mt-1.5 text-[13px] text-slate-800">
                <span className="mr-1 rounded-full bg-amber-800 px-[7px] py-0.5 text-[11px] font-extrabold text-white">
                  {AD_BADGE_LABEL}
                </span>
                <span data-testid="partner-disclosure">{CARD_DISCLOSURE[p]}</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-500" data-testid="partner-link-note">
                {CARD_LINK_NOTE[p]}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="3. 링크하지 않는 것">
        <p className="mb-2">아래는 수수료가 있더라도 제휴 링크를 걸지 않아요. 체크만 할 수 있어요.</p>
        <ul className="list-disc space-y-1 pl-5" data-testid="never-link">
          {NEVER_LINK_GROUPS.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </Section>

      <Section title="4. 품목을 고르는 기준">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            체크 품목은 가이드 본문과 공식 안내(예: 임신육아종합포털 아이사랑의 준비물 목록)에 나온 것만
            넣어요. 수수료율을 보고 품목을 고르지 않아요.
          </li>
          <li>
            엄빠레이더는 특정 제품을 써 보고 추천하지 않아요. 순위·후기·&lsquo;추천템&rsquo; 표현을 쓰지
            않아요.
          </li>
          <li>가이드 본문, 지원금·혜택 카드의 순서와 내용은 제휴 수수료와 관계없어요.</li>
          <li>가격·재고·배송·교환은 판매처 기준이에요. 구매 문의는 판매처로 해 주세요.</li>
        </ul>
      </Section>

      <Section title="5. 제휴 서비스">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>링크프라이스</strong>: 판매처의 품목 검색 결과로 연결되는 링크(딥링크)를 써요.
          </li>
          <li>
            <strong>네이버 쇼핑 커넥트</strong>: 네이버 쇼핑의 판매 상품 1개로 연결되는 링크를 써요.
          </li>
          <li>
            한 카드에는 한 제휴 서비스의 링크만 붙여요. 카드의 수수료 안내 문장으로 어느 서비스인지 알 수
            있어요.
          </li>
          <li>엄빠레이더 운영자·가족은 자기 제휴 링크로 구매하지 않아요.</li>
        </ul>
      </Section>

      <Section title="6. 쿠키와 기록">
        <ul className="list-disc space-y-1 pl-5">
          <li>{PRIVACY_PARTNER_COOKIE_LINE}</li>
          <li>
            엄빠레이더는 어떤 카드·품목의 가격 보기가 눌렸는지만 익명 이벤트로 기록해요(이름·연락처 없음).
            자세한 내용은{" "}
            <Link href="/privacy" className="font-semibold text-rose-600 underline">
              개인정보처리방침
            </Link>
            에 있어요.
          </li>
          <li>체크한 항목은 이 기기에만 저장돼요. 서버로 보내지 않아요.</li>
        </ul>
      </Section>

      <Section title="7. 근거와 문의">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            표시 방식은 공정거래위원회 「추천·보증 등에 관한 표시·광고 심사지침」과 안내서의 경제적
            이해관계 표시 원칙(찾기 쉬운 위치·알아보기 쉬운 형태·명확한 내용·같은 언어)을 따라요. 그래서
            고지는 이 페이지가 아니라 카드 맨 위에 항상 보이고, &lsquo;AD&rsquo;·&lsquo;Sponsored&rsquo; 대신
            한국어 &lsquo;{AD_BADGE_LABEL}&rsquo;를 써요.
          </li>
          <li>
            표시가 빠졌거나 헷갈리는 카드를 보면{" "}
            <a href="mailto:umbba.radar@gmail.com" className="font-semibold text-rose-600 underline">
              umbba.radar@gmail.com
            </a>
            으로 알려 주세요.
          </li>
          <li>
            업체·브랜드의 광고·협찬 문의는{" "}
            <Link href="/business" className="font-semibold text-slate-700 underline">
              업체·브랜드 문의
            </Link>
            로 받아요.
          </li>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-base font-bold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

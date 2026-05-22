// ============================================
// 이용약관 — /terms
// ⚠️ 초안. 본격 출시·법무 검토 전에 변호사·법률 자문 필수.
// ============================================

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 — 엄빠레이더",
  description: "엄빠레이더 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 text-sm leading-relaxed text-slate-700">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          이용약관
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          시행일: 2026년 5월 22일 · 최종 업데이트: 2026년 5월 22일
        </p>
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          ⚠️ 본 약관은 <strong>초안(draft)</strong>입니다. 정식 출시 전 법률
          전문가의 검토를 거쳐 갱신될 예정입니다.
        </div>
      </header>

      <Section title="제1조 (목적)">
        <p>
          본 약관은 엄빠레이더(이하 &quot;서비스&quot;)가 제공하는 임신·출산·육아
          관련 협찬·체험단·후기 정보 큐레이션 서비스의 이용 조건 및 절차,
          이용자와 서비스 운영자 간의 권리·의무·책임 사항 등을 규정함을
          목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (용어의 정의)">
        <ul className="list-disc space-y-1 pl-5">
          <li>&quot;서비스&quot;: 엄빠레이더 웹앱 및 향후 미니앱 형태의 모든 채널</li>
          <li>&quot;이용자&quot;: 본 약관에 따라 서비스를 이용하는 회원·비회원</li>
          <li>&quot;콘텐츠&quot;: 서비스에 게재된 카드(모집글·후기·공구·광고 등) 일체</li>
          <li>&quot;외부 링크&quot;: 카드 상세에서 연결되는 제3자 인스타그램·블로그 페이지</li>
        </ul>
      </Section>

      <Section title="제3조 (서비스의 제공)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            서비스는 외부에 흩어진 육아 관련 협찬·체험단·후기 정보를 큐레이션해
            제공합니다.
          </li>
          <li>
            <strong>모든 신청·체험·구매 행위는 외부 제3자 페이지에서 진행</strong>되며,
            서비스는 신청 결과·배송·환불·분쟁 등에 직접 관여하지 않습니다.
          </li>
          <li>
            서비스는 정보의 정확성·최신성을 위해 합리적인 노력을 기울이지만,
            외부 페이지의 변경·삭제·오류로 인한 손해는 책임지지 않습니다.
          </li>
        </ol>
      </Section>

      <Section title="제4조 (이용자의 의무)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>이용자는 다음 행위를 해서는 안 됩니다.</li>
          <li className="list-none">
            <ul className="ml-4 list-disc space-y-0.5">
              <li>타인의 정보 도용·허위 정보 등록</li>
              <li>서비스에 게재된 정보의 무단 복제·배포·상업적 이용</li>
              <li>자동화된 수단으로 서비스에 비정상적 부하를 주는 행위</li>
              <li>서비스 운영을 방해하는 일체의 행위</li>
            </ul>
          </li>
          <li>
            위반 시 서비스 이용이 제한될 수 있으며, 법적 책임을 질 수 있습니다.
          </li>
        </ol>
      </Section>

      <Section title="제5조 (콘텐츠의 권리)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            서비스에 게재된 카드의 원본 저작권은 해당 콘텐츠를 제작한 브랜드·창작자에게
            있습니다. 서비스는 큐레이션·요약·인용의 범위에서만 사용합니다.
          </li>
          <li>
            저작권 침해 우려가 있는 콘텐츠는 운영자에게 신고 시 신속히 검토·삭제됩니다.
          </li>
          <li>
            이용자가 작성한 후기·제보·코멘트의 저작권은 이용자에게 있으나, 서비스 운영
            목적의 비독점적 사용권을 서비스에 허락합니다.
          </li>
        </ol>
      </Section>

      <Section title="제6조 (면책)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            서비스는 외부 협찬·체험단 신청 결과(당첨·배송·품질·환불 등)에 대해
            책임지지 않습니다.
          </li>
          <li>
            천재지변·전기통신서비스 장애 등 불가항력으로 인한 서비스 중단에 대해
            책임지지 않습니다.
          </li>
          <li>
            이용자 간 또는 이용자와 제3자(브랜드 등) 간 분쟁에 개입하지 않습니다.
          </li>
        </ol>
      </Section>

      <Section title="제7조 (서비스 변경·중단)">
        <p>
          서비스는 운영상·기술상의 사유로 사전 공지 후 서비스를 변경·중단할 수
          있으며, 사용자에게 발생한 손해에 대해 별도 보상하지 않습니다 (관련
          법령에 위반되지 않는 범위 내).
        </p>
      </Section>

      <Section title="제8조 (계정 해지·이용 제한)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>이용자는 언제든 계정을 탈퇴할 수 있습니다.</li>
          <li>
            본 약관 위반·법령 위반·기타 운영상 필요 시 서비스 이용을 제한할 수
            있습니다.
          </li>
        </ol>
      </Section>

      <Section title="제9조 (준거법 및 관할)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>본 약관은 대한민국 법령에 따라 해석·집행됩니다.</li>
          <li>
            서비스 이용과 관련하여 분쟁이 발생할 경우 민사소송법상 관할 법원에
            제소합니다.
          </li>
        </ol>
      </Section>

      <Section title="제10조 (약관의 변경)">
        <p>
          본 약관은 관련 법령·운영 정책에 따라 변경될 수 있으며, 변경 시 시행일
          7일 전 공지합니다. 중대한 변경의 경우 30일 전 공지하며, 변경 후 계속
          이용 시 동의로 간주합니다.
        </p>
      </Section>

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
        문의: 본 서비스 운영자에게 연락 (운영자 연락처는 출시 정식 약관에 표기 예정).
      </footer>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-base font-bold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

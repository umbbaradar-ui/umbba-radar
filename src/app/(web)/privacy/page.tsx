// ============================================
// 개인정보처리방침 — /privacy
// ⚠️ 초안. 실제 출시 전 개인정보보호법 준수 여부 법무 검토 필수.
// ============================================

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 — 엄빠레이더",
  description: "엄빠레이더 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 text-sm leading-relaxed text-slate-700">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          개인정보처리방침
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          시행일: 2026년 5월 22일 · 최종 업데이트: 2026년 5월 22일
        </p>
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          ⚠️ 본 방침은 <strong>초안(draft)</strong>입니다. 정식 출시 전
          개인정보보호법·정보통신망법 준수 여부 법무 검토가 필요합니다.
        </div>
      </header>

      <Section title="1. 수집하는 개인정보">
        <p className="mb-2">
          엄빠레이더는 다음과 같은 개인정보를 수집·이용합니다.
        </p>
        <div className="space-y-3">
          <SubItem
            label="필수 (구글 로그인 시)"
            items={[
              "이메일 주소",
              "이름 / 닉네임",
              "프로필 사진 URL",
              "구글 계정 고유 ID",
            ]}
          />
          <SubItem
            label="자동 수집"
            items={[
              "익명 식별자 (anon_id, 로컬스토리지에 저장된 UUID)",
              "행동 이벤트 (카드 클릭·관심·신청함 체크·외부 링크 클릭·필터 변경 등)",
              "기기 정보 (User Agent)",
              "접속 IP 주소 (호스팅 서비스 로그)",
              "Referer (이전 페이지 URL)",
            ]}
          />
          <SubItem
            label="로컬 저장 (이 기기에만)"
            items={[
              "카드별 신청함/관심 체크 상태 (서버 전송 안 됨, 로컬스토리지에만 저장)",
            ]}
          />
        </div>
      </Section>

      <Section title="2. 수집·이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>로그인 사용자 식별·인증 (구글 계정 정보)</li>
          <li>서비스 개선을 위한 행동 분석 및 UX 최적화 (행동 이벤트)</li>
          <li>광고주에게 익명 통계 제공 (집계된 형태만, 개인 식별 불가)</li>
          <li>부정 이용·악용 방지 (IP·User Agent)</li>
        </ul>
      </Section>

      <Section title="3. 보유·이용 기간">
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 계정 정보: <strong>회원 탈퇴 시까지</strong></li>
          <li>행동 이벤트 (events 테이블): 수집일로부터 최대 <strong>2년</strong></li>
          <li>익명 식별자: 동일 기기에서 로컬스토리지가 유지되는 동안</li>
          <li>법령에 의한 보존 의무가 있는 경우 해당 기간까지</li>
        </ul>
      </Section>

      <Section title="4. 제3자에게의 제공">
        <p>
          서비스는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단,
          법령에 의해 요구되는 경우는 예외입니다.
        </p>
        <p className="mt-2">
          광고주에게 제공되는 통계는 <strong>익명·집계 형태</strong>이며, 개별
          이용자를 식별할 수 없습니다.
        </p>
      </Section>

      <Section title="5. 개인정보 처리 위탁">
        <p className="mb-2">
          서비스는 다음 위탁사를 통해 개인정보를 처리합니다.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-bold">위탁사</th>
                <th className="px-3 py-2 text-left font-bold">목적</th>
                <th className="px-3 py-2 text-left font-bold">처리 지역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2">Supabase Inc.</td>
                <td className="px-3 py-2">데이터베이스·인증</td>
                <td className="px-3 py-2">대한민국 (Seoul 리전)</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Vercel Inc.</td>
                <td className="px-3 py-2">웹 호스팅·분석</td>
                <td className="px-3 py-2">전 세계 (CDN)</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Google LLC</td>
                <td className="px-3 py-2">OAuth 인증</td>
                <td className="px-3 py-2">미국 외</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="6. 이용자의 권리">
        <ul className="list-disc space-y-1 pl-5">
          <li>개인정보 열람·정정·삭제·처리정지를 요청할 권리</li>
          <li>구글 OAuth 동의를 언제든 철회할 권리 (구글 계정 설정에서 직접)</li>
          <li>회원 탈퇴 시 모든 계정 정보 즉시 삭제</li>
          <li>로컬스토리지 데이터는 브라우저에서 직접 삭제 가능</li>
        </ul>
      </Section>

      <Section title="7. 쿠키·로컬스토리지">
        <p className="mb-2">서비스는 다음 목적으로 쿠키와 로컬스토리지를 사용합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>로그인 세션 유지 (HttpOnly 쿠키)</li>
          <li>관리자 인증 (umbba-admin 쿠키)</li>
          <li>익명 식별자 보존 (umbba-radar:anon-id, 로컬스토리지)</li>
          <li>신청함/관심 체크 상태 (umbba-radar:user-post-status, 로컬스토리지)</li>
        </ul>
        <p className="mt-2">
          브라우저 설정에서 쿠키·로컬스토리지를 거부할 수 있으나, 일부 기능이 제한될
          수 있습니다.
        </p>
      </Section>

      <Section title="8. 안전성 확보 조치">
        <ul className="list-disc space-y-1 pl-5">
          <li>모든 통신 HTTPS 암호화</li>
          <li>비밀번호·세션은 HttpOnly 쿠키로 클라이언트 노출 차단</li>
          <li>데이터베이스 접근은 Row Level Security (RLS) 정책으로 제한</li>
          <li>관리자 키는 서버 환경변수에만 저장, 클라이언트 미노출</li>
        </ul>
      </Section>

      <Section title="9. 14세 미만 아동의 정보">
        <p>
          서비스는 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다. 본
          서비스의 대상은 성인 부모입니다. 14세 미만이 본인 정보를 입력한 사실을
          알게 되면 즉시 삭제합니다.
        </p>
      </Section>

      <Section title="10. 방침의 변경">
        <p>
          본 방침이 변경될 경우 시행일 7일 전 서비스에 공지합니다. 중대한 변경은
          30일 전 공지합니다.
        </p>
      </Section>

      <Section title="11. 개인정보 보호 책임자">
        <p>
          개인정보 관련 문의·민원·피해 구제 요청은 본 서비스 운영자에게 연락 바랍니다.
          (구체 연락처는 정식 출시 시 명기 예정)
        </p>
      </Section>

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
        본 방침은 한국 개인정보보호법 및 정보통신망법을 준수하기 위해 작성된 초안이며,
        정식 출시 전 법무 검토를 거쳐 확정됩니다.
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

function SubItem({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-800">{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

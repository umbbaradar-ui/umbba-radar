// ============================================
// 계정·데이터 삭제 안내 — /account-deletion
//
// Google Play 정책(2024년~) 필수:
//   "사용자가 계정 및 관련 데이터의 삭제를 요청할 수 있는 링크"를
//   Play Console 스토어 등록정보에 반드시 등록해야 함.
//
// 요건:
//   1. 앱/개발자 이름 명시
//   2. 삭제 요청 단계를 눈에 띄게
//   3. 삭제되는 데이터 유형 + 보관 항목·기간 명시
//
// 운영 이메일: umbba.radar@gmail.com (고정)
// ============================================

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "계정 삭제 — 엄빠레이더",
  description:
    "엄빠레이더 계정과 관련 데이터(자녀 정보·관심 카드·알림 구독 등) 삭제 요청 안내.",
};

// 운영 이메일 (개인정보·계정 삭제·기타 문의 공식 채널)
const SUPPORT_EMAIL = "umbba.radar@gmail.com";

export default function AccountDeletionPage() {
  const subject = encodeURIComponent("[엄빠레이더] 계정 삭제 요청");
  const body = encodeURIComponent(
    "안녕하세요, 엄빠레이더 운영팀.\n\n" +
      "다음 계정에 대한 삭제를 요청합니다.\n\n" +
      "가입 이메일: \n" +
      "가입 방법(이메일/구글): \n" +
      "추가 요청 사항(있다면): \n\n" +
      "확인 부탁드립니다."
  );
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 text-sm leading-relaxed text-slate-700">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          계정 삭제 안내
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          앱 이름: <strong>엄빠레이더</strong> · 개발자: 엄빠레이더 운영팀 ·
          시행일: 2026년 5월 25일
        </p>
      </header>

      <Section title="요약">
        <p>
          엄빠레이더 계정과 모든 관련 데이터(자녀 정보·관심 카드·신청 기록·
          푸시 알림 구독 등)는 사용자 요청 시 <strong>즉시 영구 삭제</strong>됩니다.
          삭제 후엔 복구할 수 없으니 신중히 결정해주세요.
        </p>
      </Section>

      <Section title="1. 삭제 요청 방법">
        <p className="mb-3">
          현재 두 가지 경로로 삭제를 요청할 수 있어요. 어느 쪽이든 결과는
          동일합니다.
        </p>

        <Step
          num="A"
          title="(권장) 운영팀에 이메일 요청"
          steps={[
            <>
              아래 버튼을 눌러 메일 앱을 엽니다. 또는{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">
                {SUPPORT_EMAIL}
              </code>{" "}
              로 직접 보내셔도 됩니다.
            </>,
            "메일 본문에 가입한 이메일 주소를 적어주세요 (계정 확인용).",
            "운영팀이 본인 확인 후 영업일 기준 3일 이내에 삭제 처리합니다.",
            "처리 완료 시 동일 이메일로 결과 안내드립니다.",
          ]}
        >
          <a
            href={mailto}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600"
          >
            ✉️ 삭제 요청 메일 작성하기
          </a>
        </Step>

        <Step
          num="B"
          title="(예정) 앱 안에서 직접 삭제"
          steps={[
            "엄빠레이더 앱 또는 웹 로그인",
            <>
              하단 <strong>내 레이더</strong> 탭 →{" "}
              <strong>마이페이지</strong> 진입
            </>,
            <>
              화면 하단 <strong>계정 삭제</strong> 버튼 (도입 예정)
            </>,
            "최종 확인 후 즉시 삭제",
          ]}
        >
          <p className="mt-2 text-xs text-amber-700">
            앱 내 자동 삭제 기능은 2026년 6월 도입 예정. 그 전까지는 위 A
            방법(이메일)으로 요청해주세요.
          </p>
        </Step>
      </Section>

      <Section title="2. 삭제되는 데이터 (영구 삭제, 복구 불가)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>로그인 계정 (이메일 / Google OAuth 연결 정보)</li>
          <li>이름·닉네임·프로필 이미지 URL</li>
          <li>자녀 정보 (생년월일·성별·닉네임)</li>
          <li>부모 역할 정보 (엄마/아빠/기타)</li>
          <li>관심·신청 표시한 카드 기록</li>
          <li>회원 가입 후 작성한 제보 내역 (사용자 식별 정보 부분)</li>
          <li>푸시 알림 구독 정보 (endpoint·키)</li>
          <li>알림 확인 시각·앱 사용 패턴 등 개인 이벤트 로그</li>
        </ul>
      </Section>

      <Section title="3. 보관되는 데이터 (사용자 식별 정보 제거 후)">
        <p className="mb-2">
          다음 항목은 서비스 운영·통계 목적으로 익명화된 상태로 보관됩니다.
          삭제 후엔 어떤 방법으로도 사용자를 식별할 수 없습니다.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>익명화된 사용 통계</strong>: 카드 클릭 수·검색 트렌드 등.
            user_id가 삭제되어 누구인지 알 수 없음. 보관 기간 무제한
            (서비스 개선 목적).
          </li>
          <li>
            <strong>공개된 카드 콘텐츠</strong>: 사용자가 제보한 카드 중
            관리자 검수 후 발행된 것은 식별 정보 분리 후 유지 (다른 사용자가
            이미 사용 중인 정보).
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          ※ 법령에 따라 보관 의무가 있는 데이터는 별도로 명시하나, 현재
          엄빠레이더는 통신·금융·전자상거래 사업자가 아니어서 별도 법정
          보관 의무 없습니다.
        </p>
      </Section>

      <Section title="4. 삭제 후 재가입">
        <p>
          동일 이메일로 다시 가입 가능합니다. 단, 이전 데이터(자녀 정보·
          관심 카드 등)는 복구되지 않고 새 계정으로 시작됩니다.
        </p>
      </Section>

      <Section title="5. 문의">
        <p>
          삭제 처리·개인정보 관련 문의는{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-rose-600 underline"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          로 보내주세요.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          개인정보처리방침 전문은{" "}
          <a
            href="/privacy"
            className="font-semibold text-slate-700 underline"
          >
            /privacy
          </a>{" "}
          에서 확인할 수 있습니다.
        </p>
      </Section>
    </main>
  );
}

// ============================================
// 헬퍼 컴포넌트
// ============================================
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-base font-extrabold text-slate-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Step({
  num,
  title,
  steps,
  children,
}: {
  num: string;
  title: string;
  steps: React.ReactNode[];
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs font-extrabold text-rose-700">
          {num}
        </span>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {children}
    </div>
  );
}

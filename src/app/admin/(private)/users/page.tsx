// ============================================
// 회원 관리 — /admin/users
// auth.users + user_profiles + children + push_subscriptions 조합 표시
// ============================================

import Link from "next/link";
import { listAdminUsers } from "@/modules/user/admin-service";
import { UserRow } from "./UserRow";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);

  // active7/active30은 events(방문) 기준으로 서비스단에서 계산 — last_sign_in_at 아님
  const { users, total, active7, active30 } = await listAdminUsers(page, PER_PAGE);

  const totalPages = Math.max(Math.ceil(total / PER_PAGE), 1);

  // 통계
  const withChildren = users.filter((u) => u.children.length > 0).length;
  const withPush = users.filter((u) => u.push_subscription_count > 0).length;

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          회원 관리
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          전체 {total}명 · 자녀 등록 {withChildren}명 · 푸시 구독 {withPush}명 ·{" "}
          <strong className="text-emerald-700">7일 내 방문 {active7}명</strong> ·
          30일 내 {active30}명
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          <strong>&quot;최근 인증&quot;은 리텐션 지표가 아닙니다.</strong> 마지막{" "}
          <em>로그인</em> 시점만 기록되고, 세션이 유지된 채 매일 방문해도
          갱신되지 않습니다(실제로 활동 중인 회원도 &quot;2개월 전&quot;으로
          표시됨). <strong>휴면·리텐션 판정은 &quot;최근 방문&quot;</strong>(활동
          이벤트 기준)으로 보세요.
          <br />
          <span className="text-amber-700">
            ※ 최근 방문은 카드 클릭·필터·검색 등 <em>행동</em>이 있어야 잡힙니다.
            열어보기만 한 방문은 아직 집계되지 않습니다(app_open 이벤트 추가 후
            해소).
          </span>
        </p>
        <p className="mt-1.5 text-[11px] text-slate-400">
          삭제 시 회원 + 자녀 + 푸시 구독 + 본인 마이그레이션 데이터 모두 영구
          삭제됩니다 (복구 불가).
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">이메일 / 표시명</th>
              <th className="px-4 py-3 font-medium">로그인 방식</th>
              <th className="px-4 py-3 font-medium">부모 역할</th>
              <th className="px-4 py-3 font-medium">자녀</th>
              <th className="px-4 py-3 font-medium text-center">푸시</th>
              <th className="px-4 py-3 font-medium">가입</th>
              <th className="px-4 py-3 font-medium text-slate-400">최근 인증</th>
              <th className="px-4 py-3 font-medium">최근 방문</th>
              <th className="px-4 py-3 font-medium">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  회원이 없어요.
                </td>
              </tr>
            ) : (
              users.map((u) => <UserRow key={u.id} user={u} />)
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs">
          {page > 1 && (
            <Link
              href={`/admin/users?page=${page - 1}`}
              className="rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200"
            >
              ← 이전
            </Link>
          )}
          <span className="px-3 text-slate-500">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/users?page=${page + 1}`}
              className="rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200"
            >
              다음 →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

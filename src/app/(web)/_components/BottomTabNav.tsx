"use client";

// ============================================
// 모바일 하단 탭 네비게이션 — 4탭 + 더보기 시트
// 데스크탑(md+)에서는 숨김. 모바일 PWA 풀스크린에서 "앱처럼" 느껴지게 함
//
// 4 탭 구성:
//   홈 / 내것 / 제보(강조) / 더보기(시트)
//
// 더보기 탭: 슬라이드업 시트로 보조 메뉴 (로그인/로그아웃·관리자·약관 등)
// ============================================

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SimpleUser } from "@/modules/user/service";
import { signOutAction } from "@/modules/user/actions";

interface Props {
  user: SimpleUser | null;
}

export function BottomTabNav({ user }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isHome = pathname === "/";
  const isMy = pathname.startsWith("/my");
  const isSubmit = pathname.startsWith("/submit");

  return (
    <>
      {/* 하단 탭 네비 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-100 bg-white/95 backdrop-blur md:hidden">
        <div className="pb-safe mx-auto flex max-w-md">
          <Tab href="/" label="홈" active={isHome}>
            <HomeIcon filled={isHome} />
          </Tab>
          <Tab href="/my" label="내것" active={isMy}>
            <BookmarkIcon filled={isMy} />
          </Tab>
          <SubmitTab href="/submit" label="제보" active={isSubmit} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-400 transition active:scale-95"
          >
            <MoreIcon />
            <span>더보기</span>
          </button>
        </div>
      </nav>

      {/* 더보기 시트 — backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden ${
          moreOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMoreOpen(false)}
        aria-hidden="true"
      />

      {/* 더보기 시트 — content */}
      <aside
        className={`fixed inset-x-0 bottom-0 z-50 transform border-t border-slate-200 bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          moreOpen ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!moreOpen}
      >
        <div className="pb-safe">
          {/* 손잡이 */}
          <div className="flex justify-center pt-2">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>

          {/* 사용자 영역 */}
          <div className="border-b border-slate-100 px-5 py-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-base font-bold text-rose-700">
                  {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {user.name ?? "사용자"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user.email ?? ""}
                  </p>
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    로그아웃
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMoreOpen(false)}
                className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
              >
                <span>로그인하기</span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          {/* 메뉴 */}
          <nav className="px-2 py-2">
            <SheetLink
              href="/admin"
              icon="🔒"
              label="관리자"
              onClick={() => setMoreOpen(false)}
            />
            <SheetLink
              href="/terms"
              icon="📄"
              label="이용약관"
              onClick={() => setMoreOpen(false)}
            />
            <SheetLink
              href="/privacy"
              icon="🛡️"
              label="개인정보처리방침"
              onClick={() => setMoreOpen(false)}
            />
          </nav>

          {/* 닫기 */}
          <div className="border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700"
            >
              닫기
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================
// 탭 컴포넌트
// ============================================

function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition active:scale-95 ${
        active ? "text-rose-600" : "text-slate-400"
      }`}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}

/** 제보 탭 — 가운데 강조 (primary CTA) */
function SubmitTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition active:scale-95"
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
          active ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-600"
        }`}
      >
        <PlusIcon />
      </div>
      <span className={active ? "text-rose-600" : "text-rose-500"}>
        {label}
      </span>
    </Link>
  );
}

// ============================================
// 시트 메뉴 링크
// ============================================
function SheetLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-slate-50"
    >
      <span aria-hidden="true" className="text-base">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

// ============================================
// 아이콘 (인라인 SVG, 외부 라이브러리 X)
// ============================================

function HomeIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

"use client";

// ============================================
// 모바일 하단 탭 네비게이션
// 데스크탑(md+)에서는 숨김. 모바일 PWA 풀스크린에서 "앱처럼" 느껴지게 함
// ============================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SimpleUser } from "@/modules/user/service";

interface Props {
  user: SimpleUser | null;
}

export function BottomTabNav({ user }: Props) {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "홈", icon: HomeIcon, match: (p: string) => p === "/" },
    {
      href: "/my",
      label: "내것",
      icon: BookmarkIcon,
      match: (p: string) => p.startsWith("/my"),
    },
    user
      ? {
          href: "/login",
          label: "프로필",
          icon: UserIconFilled,
          match: (p: string) => p.startsWith("/login"),
        }
      : {
          href: "/login",
          label: "로그인",
          icon: UserIcon,
          match: (p: string) => p.startsWith("/login"),
        },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-amber-100 bg-white/95 backdrop-blur md:hidden">
      <div className="pb-safe mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
                active ? "text-rose-600" : "text-slate-400"
              }`}
            >
              <Icon active={active} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================
// 아이콘 (단순 SVG, 외부 아이콘 라이브러리 의존 없음)
// ============================================

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function UserIconFilled({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="8"
        r="4"
        fill={active ? "currentColor" : "rgb(148 163 184)"}
      />
      <path
        d="M4 21a8 8 0 0 1 16 0"
        fill={active ? "currentColor" : "rgb(148 163 184)"}
      />
    </svg>
  );
}

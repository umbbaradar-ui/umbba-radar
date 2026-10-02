"use client";

// ============================================
// 관심 직후 푸시 권유 바텀시트 (prime-then-permission)
//
// 2026-10 홍보안 ①: 푸시 옵트인 3%(3/104) — 권유가 /my·/notifications 에만 있고
// 가치가 생기는 순간(카드 상세 ☆관심)엔 없었다. 관심을 켠 직후 한 번 설명하고
// [알림 받기]를 눌렀을 때만 브라우저 권한을 요청한다.
//
// 노출 판정은 StatusButtons 가 `shouldOfferPushPrompt()` 로 먼저 한다:
//   - 이미 구독(on)·권한 거부(denied)·미지원(unsupported) → 안 띄움
//   - [다음에] 로 닫으면 7일간 재노출 금지 (localStorage)
//   - 같은 세션에선 1회만 (sessionStorage) — 관심 여러 개 누를 때 연타 방지
//   - iOS + 홈 화면 미설치 → 문구만 "홈 화면에 추가하면 알림" 으로 (권한 요청 X)
//   - 비로그인 → [알림 받기] 가 기존 가입 흐름(SignupSheet 원탭) 으로 연결.
//     서버 푸시가 user_id 기준이라 로그인이 먼저. 가입 후 같은 카드로 돌아오면
//     resume 플래그로 시트를 한 번 더 띄워 권한 단계까지 이어준다.
//
// 계측 (track → /api/track → events): push_prompt_impression / push_prompt_accept /
// push_prompt_dismiss  — properties: { post_id, variant, result? }
// ============================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@/modules/analytics/service";
import { SignupSheet } from "@/modules/user/ui/SignupSheet";
import { isPWAInstalled } from "@/shared/utils/pwa";
import { detectPushStatusQuick, enablePushOnThisDevice } from "../push-client";

const DISMISS_KEY = "umbba-radar:push-prompt-dismissed-at";
const SESSION_SHOWN_KEY = "umbba-radar:push-prompt-shown";
const RESUME_KEY = "umbba-radar:push-prompt-resume";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** standard: 권한 요청 가능 / ios_install: iOS 홈 화면 미설치 / signup: 비로그인 */
export type PushPromptVariant = "standard" | "ios_install" | "signup";

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Mac/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

function shownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 관심 표시 직후 호출 — 띄울 variant 를 돌려주거나, 띄우지 않을 거면 null.
 * @param force 가입 후 복귀(resume) 시 세션 1회 제한을 무시
 */
export async function shouldOfferPushPrompt(
  loggedIn: boolean,
  force = false
): Promise<PushPromptVariant | null> {
  if (typeof window === "undefined") return null;
  if (recentlyDismissed()) return null;
  if (!force && shownThisSession()) return null;

  // iOS 홈 화면 미설치 — 어떤 브라우저든 웹푸시 불가. 설치 안내 문구로.
  if (isIOSDevice() && !isPWAInstalled()) return "ios_install";

  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    typeof Notification === "undefined"
  ) {
    return null; // 미지원(인앱 웹뷰 등) — 인앱 배너가 담당
  }
  if (Notification.permission === "denied") return null;

  // serviceWorker.ready 를 기다리지 않는 빠른 판정 (SW 미등록이면 ready 가 영영 안 끝남)
  const status = await detectPushStatusQuick();
  if (status === "on" || status === "permission-denied") return null;
  if (status === "unsupported") return null;
  if (status === "ios-not-installed") return "ios_install";

  return loggedIn ? "standard" : "signup";
}

/** 가입 흐름으로 보낸 카드 — 로그인 복귀 후 시트 재개용 */
export function consumePushPromptResume(postId: string): boolean {
  try {
    if (localStorage.getItem(RESUME_KEY) !== postId) return false;
    localStorage.removeItem(RESUME_KEY);
    return true;
  } catch {
    return false;
  }
}

interface Props {
  postId: string;
  variant: PushPromptVariant;
  onClose: () => void;
}

export function PushPromptSheet({ postId, variant, onClose }: Props) {
  const [phase, setPhase] = useState<"prompt" | "working" | "done" | "signup">(
    "prompt"
  );
  const [result, setResult] = useState<NotificationPermission | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);

  // 클릭 이후에만 마운트되는 클라이언트 전용 컴포넌트 — SSR 가드(mounted) 불필요
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_SHOWN_KEY, "1");
    } catch {
      // 무시
    }
    track("push_prompt_impression", { post_id: postId, variant });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [postId, variant]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // 무시
    }
    track("push_prompt_dismiss", { post_id: postId, variant });
    onClose();
  }

  async function accept() {
    if (variant === "ios_install") {
      track("push_prompt_accept", { post_id: postId, variant, result: "ios_guide" });
      setShowIosSteps(true);
      return;
    }
    if (variant === "signup") {
      track("push_prompt_accept", { post_id: postId, variant, result: "signup" });
      try {
        localStorage.setItem(RESUME_KEY, postId);
      } catch {
        // 무시
      }
      setPhase("signup");
      return;
    }
    setPhase("working");
    let permission: NotificationPermission = "default";
    try {
      // PushSettings 와 같은 구독 로직 (권한 → 선호 저장 → 구독·서버 저장)
      ({ permission } = await enablePushOnThisDevice());
    } catch {
      permission = "default";
    }
    track("push_prompt_accept", { post_id: postId, variant, result: permission });
    setResult(permission);
    if (permission === "granted") {
      setPhase("done");
      window.setTimeout(onClose, 1600);
    } else {
      setPhase("done");
    }
  }

  // 비로그인 — 기존 가입 흐름(원탭 소셜 + 이메일) 그대로. 가입 후 이 카드로 복귀.
  if (phase === "signup") {
    const next =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : `/post/${postId}`;
    return (
      <SignupSheet
        next={next}
        surface="push_prompt"
        headline="가입하면 마감 하루 전에 알려드려요"
        sub={
          <>
            알림은 계정 기준으로 보내드려요.
            <br />
            가입하고 돌아오면 바로 알림을 켤 수 있어요.
          </>
        }
        onClose={() => {
          try {
            localStorage.removeItem(RESUME_KEY);
          } catch {
            // 무시
          }
          onClose();
        }}
        closeLabel="다음에 할게요"
      />
    );
  }

  const isIos = variant === "ios_install";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="마감 알림 받기"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "working") dismiss();
      }}
    >
      <div className="w-full max-w-md break-keep rounded-t-3xl bg-white px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] text-center shadow-xl sm:rounded-3xl sm:pb-6 sm:pt-6">
        <div
          aria-hidden
          className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden"
        />
        {phase === "done" && result === "granted" ? (
          <>
            <div aria-hidden className="text-4xl">
              🔔
            </div>
            <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900">
              알림을 켰어요
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              관심 카드 마감 하루 전에 알려드릴게요.
            </p>
          </>
        ) : phase === "done" ? (
          <>
            <div aria-hidden className="text-4xl">
              🐻
            </div>
            <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900">
              알림이 꺼져 있어요
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {result === "denied"
                ? "브라우저에서 알림을 막았어요. 주소창 자물쇠 → 알림 → 허용으로 바꾸면 켤 수 있어요."
                : "언제든 더보기 → 푸시 알림 설정에서 켤 수 있어요."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
            >
              확인
            </button>
          </>
        ) : (
          <>
            <div aria-hidden className="text-4xl">
              ⏰
            </div>
            <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900">
              이 체험단 마감 하루 전에
              <br />
              알려드릴까요?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {isIos ? (
                <>
                  아이폰은 <strong className="text-slate-900">홈 화면에 추가</strong>
                  하면 알림을 받을 수 있어요.
                </>
              ) : (
                <>관심 카드가 내일 마감이면 딱 한 번 알려드려요.</>
              )}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              밤 9시~아침 8시엔 보내지 않아요
            </p>

            {isIos && showIosSteps && (
              <ol className="mt-4 space-y-1.5 rounded-2xl bg-amber-50 px-4 py-3 text-left text-xs leading-relaxed text-amber-900">
                <li>
                  1. <strong>Safari</strong>로 이 페이지를 열어요
                  <span className="text-amber-700"> (인스타·카톡 안이면 오른쪽 위 메뉴 → Safari로 열기)</span>
                </li>
                <li>
                  2. 하단 <strong>공유 ⎋</strong> → <strong>홈 화면에 추가</strong>
                </li>
                <li>
                  3. 홈 화면 아이콘으로 들어와 <strong>☆ 관심</strong>을 누르면 알림을
                  켤 수 있어요
                </li>
              </ol>
            )}

            <div className="mt-5 space-y-2">
              {!(isIos && showIosSteps) && (
                <button
                  type="button"
                  onClick={accept}
                  disabled={phase === "working"}
                  className="w-full rounded-xl bg-rose-500 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-60"
                >
                  {phase === "working"
                    ? "확인 중…"
                    : isIos
                      ? "홈 화면에 추가하는 법 보기"
                      : "🔔 알림 받기"}
                </button>
              )}
              <button
                type="button"
                onClick={isIos && showIosSteps ? onClose : dismiss}
                disabled={phase === "working"}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
              >
                {isIos && showIosSteps ? "확인했어요" : "다음에 할게요"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

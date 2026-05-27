"use client";

// ============================================
// 인스타 username 일괄 등록 폼 (텍스트 복붙 → 정규화 → DB)
// ============================================

import { useRef, useState, useTransition } from "react";
import {
  addAccountsAction,
  type AddAccountsActionResult,
} from "@/modules/ingestion/accounts/actions";

export function AccountForm() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AddAccountsActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!text.trim()) return;
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const r = await addAccountsAction(fd);
      setResult(r);
      if (r.ok && r.data.added > 0) setText("");
    });
  }

  // 텍스트에서 대략적인 username 추출 (미리보기)
  const previewCount = text
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-slate-700">
          username 일괄 등록 (인스타 팔로잉 페이지 텍스트 그대로 붙여넣기 OK)
        </label>
        <textarea
          name="usernames"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          rows={10}
          placeholder={`@bebetime.official\nbebetime.official\nhttps://www.instagram.com/bebetime.official/\n또는 인스타 팔로잉 페이지 텍스트를 그대로 붙여넣어도 자동 정제됩니다`}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-rose-400 disabled:opacity-60"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          토큰: <strong>{previewCount}개</strong> 중 username 패턴만 자동 추출
          (영숫자·_·. 조합 1~30자) · @ / URL prefix 자동 제거
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || previewCount === 0}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "저장 중…" : "DB에 추가"}
        </button>
      </div>

      {result && !result.ok && (
        <div className="rounded-lg bg-rose-100 px-3 py-2 text-xs text-rose-800">
          {result.error}
        </div>
      )}

      {result && result.ok && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          ✅ 신규 등록: <strong>{result.data.added}개</strong>
          {result.data.skipped_duplicate > 0 && (
            <> · 이미 있던 것: {result.data.skipped_duplicate}개</>
          )}
          {result.data.invalid > 0 && (
            <> · 형식 오류: {result.data.invalid}개</>
          )}
          {result.data.invalidUsernames.length > 0 && (
            <details className="mt-1.5 text-rose-700">
              <summary className="cursor-pointer">
                형식 오류 항목 ({result.data.invalidUsernames.length}개)
              </summary>
              <ul className="mt-1 pl-4">
                {result.data.invalidUsernames.map((u, i) => (
                  <li key={i} className="font-mono">· {u}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}

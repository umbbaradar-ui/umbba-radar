"use client";

// ============================================
// 자녀 정보 + 부모 역할 입력 폼
// 다둥이 지원 (자녀 추가 버튼), 부모는 엄마/아빠/기타 선택
// ============================================

import { useState } from "react";
import {
  saveProfileAndChildrenAction,
  type ParentRole,
} from "../actions";

interface ChildInput {
  gender: "M" | "F" | "X";
  birth_date: string;
  nickname: string;
}

interface Props {
  next: string;
}

const MAX_CHILDREN = 5;

export function ChildrenForm({ next }: Props) {
  const [parentRole, setParentRole] = useState<ParentRole>("other");
  const [children, setChildren] = useState<ChildInput[]>([
    { gender: "X", birth_date: "", nickname: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  function addChild() {
    if (children.length >= MAX_CHILDREN) return;
    setChildren([
      ...children,
      { gender: "X", birth_date: "", nickname: "" },
    ]);
  }

  function removeChild(idx: number) {
    if (children.length <= 1) return;
    setChildren(children.filter((_, i) => i !== idx));
  }

  function updateChild(
    idx: number,
    field: keyof ChildInput,
    value: string
  ) {
    setChildren(
      children.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    for (const c of children) {
      if (!c.birth_date) {
        setClientError("모든 자녀의 생년월일을 입력해주세요.");
        return;
      }
    }
    setSubmitting(true);
    try {
      await saveProfileAndChildrenAction(parentRole, children, next);
    } catch {
      setSubmitting(false);
      setClientError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 부모 역할 */}
      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">🙋 본인은?</h3>
        <p className="text-[11px] text-slate-500">
          맞춤 알림에 활용돼요 (예: "엄마, 둘째에게 적합한…")
        </p>
        <div className="grid grid-cols-3 gap-2">
          <RolePill
            checked={parentRole === "mother"}
            onClick={() => setParentRole("mother")}
            emoji="👩"
            label="엄마"
          />
          <RolePill
            checked={parentRole === "father"}
            onClick={() => setParentRole("father")}
            emoji="👨"
            label="아빠"
          />
          <RolePill
            checked={parentRole === "other"}
            onClick={() => setParentRole("other")}
            emoji="🤍"
            label="기타"
          />
        </div>
      </section>

      {/* 자녀들 */}
      {children.map((child, idx) => (
        <section
          key={idx}
          className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
        >
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              자녀 {idx + 1}
            </h3>
            {children.length > 1 && (
              <button
                type="button"
                onClick={() => removeChild(idx)}
                className="text-[11px] text-slate-400 hover:text-rose-600"
              >
                삭제
              </button>
            )}
          </header>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">성별</p>
            <div className="grid grid-cols-3 gap-2">
              <RolePill
                checked={child.gender === "F"}
                onClick={() => updateChild(idx, "gender", "F")}
                emoji="👧"
                label="여"
              />
              <RolePill
                checked={child.gender === "M"}
                onClick={() => updateChild(idx, "gender", "M")}
                emoji="👦"
                label="남"
              />
              <RolePill
                checked={child.gender === "X"}
                onClick={() => updateChild(idx, "gender", "X")}
                emoji="🤍"
                label="비공개"
              />
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">
              생년월일{" "}
              <span className="text-[11px] font-normal text-slate-400">
                (출산 예정일 입력도 OK)
              </span>
            </span>
            <input
              type="date"
              required
              value={child.birth_date}
              onChange={(e) =>
                updateChild(idx, "birth_date", e.target.value)
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">
              별명{" "}
              <span className="text-[11px] font-normal text-slate-400">
                (선택, 알림에 표시)
              </span>
            </span>
            <input
              type="text"
              maxLength={20}
              value={child.nickname}
              onChange={(e) =>
                updateChild(idx, "nickname", e.target.value)
              }
              placeholder={idx === 0 ? "예: 첫째 / 보리" : `예: ${idx + 1}째`}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400"
            />
          </label>
        </section>
      ))}

      {children.length < MAX_CHILDREN && (
        <button
          type="button"
          onClick={addChild}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
        >
          + 자녀 한 명 더 추가
        </button>
      )}

      {clientError && (
        <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {clientError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "저장 중…" : "완료 →"}
      </button>
    </form>
  );
}

function RolePill({
  checked,
  onClick,
  emoji,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition ${
        checked
          ? "border-rose-400 bg-rose-50 text-rose-900"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      <span aria-hidden="true">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

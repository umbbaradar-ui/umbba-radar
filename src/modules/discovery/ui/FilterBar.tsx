"use client";

import { useRouter } from "next/navigation";
import { STAGE_LABELS, TYPE_LABELS } from "@/shared/types/post";

interface Props {
  stage: string;
  type: string;
}

export function FilterBar({ stage, type }: Props) {
  const router = useRouter();

  function update(key: "stage" | "type", value: string) {
    const params = new URLSearchParams();
    const current = { stage, type, [key]: value };
    if (current.stage && current.stage !== "all") params.set("stage", current.stage);
    if (current.type && current.type !== "all") params.set("type", current.type);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="space-y-3">
      <PillRow label="시기">
        <Pill active={stage === "all"} onClick={() => update("stage", "all")}>
          전체
        </Pill>
        {Object.entries(STAGE_LABELS).map(([k, v]) => (
          <Pill key={k} active={stage === k} onClick={() => update("stage", k)}>
            {v}
          </Pill>
        ))}
      </PillRow>
      <PillRow label="유형">
        <Pill active={type === "all"} onClick={() => update("type", "all")}>
          전체
        </Pill>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <Pill key={k} active={type === k} onClick={() => update("type", k)}>
            {v}
          </Pill>
        ))}
      </PillRow>
    </div>
  );
}

function PillRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

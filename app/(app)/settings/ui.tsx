"use client";

import { useState, type ReactNode } from "react";

export const inputClass =
  "min-h-11 w-full rounded-[4px] border border-field bg-white px-3 text-[16px] text-ink placeholder:text-ghost focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 disabled:bg-panel disabled:text-muted";

export function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-[4px] border border-line bg-white">
      <div className="border-b border-line bg-head px-4 py-2.5">
        <h2 className="text-[16px] font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-[14px] text-muted">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-[15px] ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-ink-2">{label}</span>
      {children}
    </label>
  );
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

/** 儲存按鈕＋狀態文字；run 回傳錯誤訊息或 null */
export function useSave() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const run = async (fn: () => Promise<string | null>) => {
    setStatus({ kind: "saving" });
    const err = await fn();
    setStatus(err ? { kind: "error", message: err } : { kind: "saved" });
    return !err;
  };
  const reset = () => setStatus({ kind: "idle" });
  return { status, run, reset };
}

export function SaveButton({
  status,
  dirty,
  onClick,
  label = "儲存",
}: {
  status: Status;
  dirty: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={!dirty || status.kind === "saving"}
        className="min-h-11 rounded-[4px] bg-brand-600 px-5 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-40"
      >
        {status.kind === "saving" ? "儲存中…" : label}
      </button>
      {status.kind === "saved" && !dirty && <span className="text-[15px] font-bold text-brand-700">已儲存</span>}
      {status.kind === "error" && <span role="alert" className="text-[15px] font-bold text-red-700">{status.message}</span>}
    </div>
  );
}

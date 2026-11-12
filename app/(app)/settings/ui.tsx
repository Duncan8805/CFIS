"use client";

import { useState, type ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-field bg-white px-3 py-2 text-[15px] focus:border-brand-500 focus:outline-none disabled:bg-paper";

export function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-line bg-white p-4 md:p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-muted">{label}</span>
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
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-40"
      >
        {status.kind === "saving" ? "儲存中…" : label}
      </button>
      {status.kind === "saved" && !dirty && <span className="text-sm text-brand-700">已儲存</span>}
      {status.kind === "error" && <span className="text-sm text-red-700">{status.message}</span>}
    </div>
  );
}

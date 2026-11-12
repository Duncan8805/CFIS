"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { switchPeriod } from "@/app/actions/periods";

export interface PeriodOption {
  id: number;
  label: string;
}

/** 左上角「目前期別」選單：切換期別、新增期別 */
export function PeriodSwitcher({
  periods,
  currentId,
  latestId,
  canCreate,
  onNavigate,
}: {
  periods: PeriodOption[];
  currentId: number;
  latestId: number;
  canCreate: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const current = periods.find((p) => p.id === currentId);
  const isPast = currentId !== latestId;
  const past = periods.filter((p) => p.id !== latestId);
  const latest = periods.find((p) => p.id === latestId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = (id: number) => {
    setOpen(false);
    if (id === currentId) return;
    startTransition(async () => {
      const r = await switchPeriod(id);
      if (r.ok) {
        router.refresh();
        onNavigate?.();
      } else alert(r.error);
    });
  };

  const item = (p: PeriodOption, tag?: string) => (
    <button
      key={p.id}
      type="button"
      role="menuitemradio"
      aria-checked={p.id === currentId}
      onClick={() => choose(p.id)}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left ${
        p.id === currentId ? "bg-brand-100 font-bold text-brand-700" : "hover:bg-paper"
      }`}
    >
      {p.label}
      {tag && <span className="ml-auto text-xs font-normal">{tag}</span>}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left ${
          isPast ? "border-2 border-warn-500 bg-warn-50" : open ? "border-2 border-brand-600 bg-white" : "border border-line bg-panel"
        }`}
      >
        <span className="flex flex-col gap-0.5">
          <span className={`text-xs ${isPast ? "text-warn-800" : "text-muted"}`}>{isPast ? "正在看過去的期別" : "目前期別"}</span>
          <span className="font-bold">{pending ? "切換中…" : (current?.label ?? "")}</span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden="true">
          <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="選擇期別"
          className="absolute left-0 top-full z-30 mt-1.5 flex w-64 flex-col gap-0.5 rounded-xl border border-field bg-white p-1.5 shadow-[0_10px_28px_rgba(29,28,26,0.16)]"
        >
          {latest && item(latest, "目前")}
          <div className="px-3 pb-0.5 pt-1.5 text-xs text-faint">過去的期別</div>
          {past.length ? past.map((p) => item(p)) : <div className="px-3 py-2 text-sm text-ghost">匯入舊期別 Excel 後會出現在這裡</div>}
          {canCreate && (
            <>
              <div className="my-1 h-px bg-line-soft" />
              <Link
                href="/periods/new"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="rounded-lg px-3 py-2.5 font-bold text-brand-600 hover:bg-paper"
              >
                ＋ 新增期別
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 看過去期別時，每一頁上方的提示列 */
export function PastPeriodBanner({ current, latest }: { current: PeriodOption; latest: PeriodOption }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="status" className="no-print flex flex-wrap items-center gap-3 border-b border-warn-line bg-warn-100 px-4 py-3 md:px-7">
      <svg viewBox="0 0 24 24" fill="none" stroke="#9A5B00" strokeWidth={2} className="size-5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
      <span className="min-w-60 flex-1 text-sm md:text-[15px]">
        <b>你正在看 {current.label}</b>（目前作業中的是 {latest.label}）。這裡的修改會改到{current.label.replace(/^\d+ 年/, "")}的帳。
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await switchPeriod(latest.id);
            if (r.ok) router.refresh();
          })
        }
        className="h-9 rounded-[10px] bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "切換中…" : `回到 ${latest.label}`}
      </button>
    </div>
  );
}

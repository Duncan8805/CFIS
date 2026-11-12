"use client";

import { useEffect, useState } from "react";
import { formatDate, WEEKLY_LABEL, weeklyFieldText, type WeeklyField } from "@/lib/weekly/fields";
import { fmt, type WeeklySaveFn, type WRow } from "./weekly-sheet";

// 手機版週報表：一筆一張卡片，點開補日期與水分

export function WeeklyCards({ rows, save }: { rows: WRow[]; save: WeeklySaveFn }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = rows.find((r) => r.row.entryId === editingId) ?? null;

  return (
    <>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.row.entryId}>
            <button
              type="button"
              onClick={() => setEditingId(r.row.entryId)}
              className="tabular flex w-full flex-col gap-1 rounded-xl border border-line bg-white p-3 text-left active:bg-brand-50"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-xs text-ghost">{i + 1}</span>
                <span className="text-lg font-bold">{r.row.name || "（沒有姓名）"}</span>
                {r.saving && <span className="size-2 animate-pulse rounded-full bg-brand-500" aria-label="儲存中" />}
                {r.row.kg !== null && <span className="ml-auto text-sm text-muted">{fmt(r.row.kg)} 公斤</span>}
              </span>
              <span className="flex items-baseline gap-3 text-sm">
                <span className={r.row.intakeDate ? "text-ink-2" : "text-warn-700"}>
                  {r.row.intakeDate ? formatDate(r.row.intakeDate) : "未填日期"}
                </span>
                <span className={r.row.moisture !== null ? "text-ink-2" : "text-warn-700"}>
                  水分 {r.row.moisture ?? "未填"}
                </span>
                <span className="ml-auto text-muted">
                  濕穀 <b className="text-black">{fmt(r.wetQuantity)}</b>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing && <EditSheet key={editing.row.entryId} r={editing} save={save} onClose={() => setEditingId(null)} />}
    </>
  );
}

const FORM_FIELDS: { field: WeeklyField; mode?: "numeric"; placeholder?: string; wide?: boolean }[] = [
  { field: "intakeDate", placeholder: "例：6/28" },
  { field: "moisture", mode: "numeric" },
  { field: "sellTo", wide: true },
  { field: "plannedSellDate", placeholder: "例：7/15" },
  { field: "remark", wide: true },
];

function EditSheet({ r, save, onClose }: { r: WRow; save: WeeklySaveFn; onClose: () => void }) {
  const initial = Object.fromEntries(FORM_FIELDS.map(({ field }) => [field, weeklyFieldText(r.row, field, r.defaults)])) as Record<
    WeeklyField,
    string
  >;
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const changed = FORM_FIELDS.filter(({ field }) => draft[field] !== initial[field]).map(
      ({ field }) => [field, draft[field]] as [WeeklyField, string],
    );
    if (!changed.length) return onClose();
    setBusy(true);
    const err = await save(r.row.entryId, changed);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/30" role="dialog" aria-modal="true" aria-label="編輯週報表">
      <button type="button" className="min-h-12 flex-1" onClick={onClose} aria-label="關閉" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="pb-safe max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white p-4"
      >
        <div className="mb-1 flex items-center">
          <h2 className="text-lg font-bold">{r.row.name}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg px-3 py-1 text-muted">
            取消
          </button>
        </div>
        <p className="tabular mb-3 text-sm text-muted">
          {fmt(r.row.kg)} 公斤・濕穀 {fmt(r.wetQuantity)}（姓名與公斤在「公糧」修改）
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FORM_FIELDS.map(({ field, mode, placeholder, wide }) => (
            <label key={field} className={`flex flex-col gap-1 text-sm ${wide ? "col-span-2" : ""}`}>
              <span className="text-muted">{WEEKLY_LABEL[field]}</span>
              <input
                value={draft[field]}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                inputMode={mode}
                placeholder={placeholder}
                className={`tabular rounded-lg border border-field px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none ${
                  mode ? "text-right" : ""
                }`}
              />
            </label>
          ))}
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-brand-600 py-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? "儲存中…" : "儲存"}
        </button>
      </form>
    </div>
  );
}

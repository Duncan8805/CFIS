"use client";

import { useEffect, useRef, useState } from "react";
import { SAVE_FAILED_MESSAGE } from "@/components/use-record-saver";
import { DISCARD_CONFIRM, useUnsavedGuard } from "@/components/use-unsaved-guard";
import { formatDate, WEEKLY_LABEL, weeklyFieldText, type WeeklyField } from "@/lib/weekly/fields";
import { fmt, type WeeklySaveFn, type WRow } from "./weekly-sheet";

// 手機版週報表：一筆一張卡片，點開補日期與水分

export function WeeklyCards({ rows, save }: { rows: WRow[]; save: WeeklySaveFn }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = rows.find((r) => r.row.entryId === editingId) ?? null;

  return (
    <>
      <ul className="flex flex-col overflow-hidden rounded-[4px] border border-line bg-white">
        {rows.map((r, i) => (
          <li key={r.row.entryId} className="border-b border-line-soft last:border-b-0">
            <button
              type="button"
              onClick={() => setEditingId(r.row.entryId)}
              className="flex w-full flex-col gap-1 p-3 text-left active:bg-brand-50"
            >
              <span className="flex items-baseline gap-2">
                <span className="tabular text-[13px] text-muted">{i + 1}</span>
                <span className="text-lg font-bold">{r.row.name || "（沒有姓名）"}</span>
                {r.saving && <span className="size-2 animate-pulse rounded-full bg-brand-500" aria-label="儲存中" />}
                {r.row.kg !== null && <span className="ml-auto text-[15px] text-ink-2"><span className="tabular">{fmt(r.row.kg)}</span> 公斤</span>}
              </span>
              <span className="flex items-baseline gap-3 text-[15px]">
                <span className={r.row.intakeDate ? "tabular text-ink-2" : "font-bold text-warn-700"}>
                  {r.row.intakeDate ? formatDate(r.row.intakeDate) : "未填日期"}
                </span>
                <span className={r.row.moisture !== null ? "text-ink-2" : "font-bold text-warn-700"}>
                  水分 {r.row.moisture ?? "未填"}
                </span>
                <span className="ml-auto text-ink-2">
                  濕穀 <b className="tabular text-ink">{fmt(r.wetQuantity)}</b>
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
  // 改過還沒存、或正在存：不能一碰背景就關掉
  const dirty = busy || FORM_FIELDS.some(({ field }) => draft[field] !== initial[field]);
  useUnsavedGuard(dirty);
  /** 取消／Esc：有改過要先問 */
  const requestClose = () => {
    if (!dirty || confirm(DISCARD_CONFIRM)) onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = async () => {
    const changed = FORM_FIELDS.filter(({ field }) => draft[field] !== initial[field]).map(
      ({ field }) => [field, draft[field]] as [WeeklyField, string],
    );
    if (!changed.length) return onClose();
    setBusy(true);
    setError(null);
    let err: string | null;
    try {
      err = await save(r.row.entryId, changed);
    } catch {
      err = SAVE_FAILED_MESSAGE;
    } finally {
      setBusy(false);
    }
    // 沒存到：視窗留著、打的字都還在，可以再按一次儲存
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/30" role="dialog" aria-modal="true" aria-label="編輯週報表">
      <button type="button" className="min-h-12 flex-1" onClick={() => !dirty && onClose()} aria-label="關閉" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="pb-safe max-h-[88dvh] overflow-y-auto rounded-t-[4px] border-t border-line bg-white p-4"
      >
        <div className="mb-1 flex items-center">
          <h2 className="text-[20px] font-bold">{r.row.name}</h2>
          <button type="button" onClick={requestClose} className="ml-auto min-h-12 rounded-[4px] border border-field px-4 text-[17px] text-ink">
            取消
          </button>
        </div>
        <p className="mb-3 text-[15px] text-muted">
          {fmt(r.row.kg)} 公斤・濕穀 {fmt(r.wetQuantity)}（姓名與公斤在「公糧」修改）
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FORM_FIELDS.map(({ field, mode, placeholder, wide }) => (
            <label key={field} className={`flex flex-col gap-1 text-[15px] ${wide ? "col-span-2" : ""}`}>
              <span className="text-ink-2">{WEEKLY_LABEL[field]}</span>
              <input
                value={draft[field]}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                inputMode={mode}
                placeholder={placeholder}
                className={`tabular h-12 rounded-[4px] border border-field bg-white px-3 text-[17px] text-ink placeholder:text-ghost focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 ${
                  mode ? "text-right" : ""
                }`}
              />
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-[4px] border border-red-700 bg-red-50 px-3 py-2 text-[16px] text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 h-[52px] w-full rounded-[4px] bg-brand-600 text-[17px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "儲存中…" : "儲存"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { FIELD_LABEL, fieldText, type EditableField, type GrainRecordDto } from "@/lib/grain/fields";
import { fmt, type Row, type SaveFn } from "./grain-sheet";

// 手機版：一筆一張卡片，點開來編輯

export function GrainCards({
  rows,
  save,
  add,
  remove,
}: {
  rows: Row[];
  save: SaveFn;
  add: () => Promise<GrainRecordDto | null>;
  remove: (id: number) => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = rows.find((r) => r.record.id === editingId) ?? null;

  return (
    <>
      <ul className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={row.record.id}>
            <button
              type="button"
              onClick={() => setEditingId(row.record.id)}
              className="tabular flex w-full flex-col gap-1 rounded-xl border border-black/10 bg-white p-3 text-left active:bg-brand-50"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-xs text-black/35">{i + 1}</span>
                <span className="text-lg font-bold">{row.record.name || "（沒有姓名）"}</span>
                {row.saving && <span className="size-2 animate-pulse rounded-full bg-brand-500" aria-label="儲存中" />}
                {row.record.kg !== null && (
                  <span className="ml-auto text-sm text-black/50">{fmt(row.record.kg)} 公斤</span>
                )}
              </span>
              <span className="flex items-baseline gap-3 text-sm text-black/60">
                <span className="truncate">{row.record.phone}</span>
                <span className="ml-auto shrink-0">
                  收{" "}
                  <b className={row.calc.collectText ? "text-amber-700" : "text-black"}>
                    {row.calc.collectText ?? fmt(row.calc.collect)}
                  </b>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={async () => {
          const created = await add();
          if (created) setEditingId(created.id);
        }}
        className="mt-3 w-full rounded-xl border border-dashed border-brand-500 py-3 font-bold text-brand-700"
      >
        ＋ 新增一筆
      </button>

      {editing && (
        <EditSheet
          key={editing.record.id}
          row={editing}
          save={save}
          onClose={() => setEditingId(null)}
          onDelete={async () => {
            if (await remove(editing.record.id)) setEditingId(null);
          }}
        />
      )}
    </>
  );
}

const FORM_FIELDS: { field: EditableField; mode?: "numeric" | "decimal" | "tel"; list?: string }[] = [
  { field: "name", list: "farmer-names" },
  { field: "phone", mode: "tel" },
  { field: "kg", mode: "numeric" },
  { field: "fen", mode: "decimal" },
  { field: "deposit", mode: "numeric" },
  { field: "collect" },
  { field: "code" },
  { field: "address" },
];

function EditSheet({
  row,
  save,
  onClose,
  onDelete,
}: {
  row: Row;
  save: SaveFn;
  onClose: () => void;
  onDelete: () => void;
}) {
  const initial = Object.fromEntries(FORM_FIELDS.map(({ field }) => [field, fieldText(row.record, field)])) as Record<
    EditableField,
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
      ({ field }) => [field, draft[field]] as [EditableField, string],
    );
    if (!changed.length) return onClose();
    setBusy(true);
    const err = await save(row.record.id, changed);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/30" role="dialog" aria-modal="true" aria-label="編輯公糧">
      <button type="button" className="min-h-12 flex-1" onClick={onClose} aria-label="關閉" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="pb-safe max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white p-4"
      >
        <div className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">{row.record.name || "新增一筆"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg px-3 py-1 text-black/55">
            取消
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {FORM_FIELDS.map(({ field, mode, list }) => (
            <label key={field} className={`flex flex-col gap-1 text-sm ${["name", "phone", "address"].includes(field) ? "col-span-2" : ""}`}>
              <span className="text-black/60">{FIELD_LABEL[field]}</span>
              <input
                value={draft[field]}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                inputMode={mode}
                list={list}
                placeholder={field === "collect" ? `自動計算：${fmt(row.calc.collect)}` : undefined}
                className={`tabular rounded-lg border border-black/20 px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none ${
                  mode === "numeric" || mode === "decimal" ? "text-right" : ""
                }`}
              />
            </label>
          ))}
        </div>
        <dl className="tabular mt-4 grid grid-cols-3 gap-2 rounded-lg bg-brand-50 p-3 text-sm">
          {(
            [
              ["利", row.calc.interest],
              ["運費", row.calc.freight],
              ["先付", row.calc.prepaid],
            ] as const
          ).map(([label, v]) => (
            <div key={label}>
              <dt className="text-xs text-black/55">{label}</dt>
              <dd className="text-right font-bold">{fmt(v)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1 text-xs text-black/45">利、運費、先付、收會在儲存後依新數字重算</p>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onDelete} className="rounded-lg px-4 py-3 text-red-700">
            刪除
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-brand-600 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>
    </div>
  );
}

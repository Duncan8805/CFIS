"use client";

import { useEffect, useState } from "react";
import { calcGrain } from "@/lib/calc";
import {
  fieldText,
  parseField,
  splitPhones,
  totalKg,
  type EditableField,
  type GrainRecordDto,
} from "@/lib/grain/fields";
import { fmt, type Row, type SaveFn } from "./grain-sheet";

// 手機版：一筆一張卡片，點開來編輯（欄位照農會核定通知單的順序，邊打邊算）

type Preview = (record: GrainRecordDto) => ReturnType<typeof calcGrain>;

export function GrainCards({
  rows,
  save,
  add,
  remove,
  preview,
}: {
  rows: Row[];
  save: SaveFn;
  add: () => Promise<GrainRecordDto | null>;
  remove: (id: number) => Promise<boolean>;
  /** 用這一期的參數算利、運費、先付、收（編輯時即時顯示） */
  preview: Preview;
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
              className="tabular flex w-full flex-col gap-1 rounded-xl border border-line bg-white p-3 text-left active:bg-brand-50"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-xs text-faint">{i + 1}</span>
                <span className="whitespace-nowrap text-lg font-bold">{row.record.name || "（沒有姓名）"}</span>
                {row.record.fileNo && <span className="text-xs font-medium text-brand-700">{row.record.fileNo}</span>}
                {row.saving && <span className="size-2 animate-pulse rounded-full bg-brand-500" aria-label="儲存中" />}
                {row.record.kg !== null && (
                  <span className="ml-auto whitespace-nowrap text-sm text-muted">{fmt(row.record.kg)} 公斤</span>
                )}
              </span>
              <span className="flex items-end gap-3 text-sm text-muted">
                <span className="min-w-0">
                  {splitPhones(row.record.phone).map((p, k) => (
                    <span key={k} className="block whitespace-nowrap">
                      {p}
                    </span>
                  ))}
                </span>
                <span className="ml-auto shrink-0">
                  收{" "}
                  <b className={row.calc.collectText ? "text-warn-700" : "text-brand-700"}>
                    {row.calc.collectText ?? (row.record.deposit === null ? "—" : fmt(row.calc.collect))}
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
          preview={preview}
          onClose={() => setEditingId(null)}
          onDelete={async () => {
            if (await remove(editing.record.id)) setEditingId(null);
          }}
        />
      )}
    </>
  );
}

const FIELDS: EditableField[] = ["fileNo", "name", "phone", "plan", "guide", "fen", "deposit", "collect", "code", "address"];

const inputBase =
  "tabular w-full rounded-[10px] border border-field bg-white px-3 text-ink focus:border-brand-600 focus:outline-none";

function EditSheet({
  row,
  save,
  preview,
  onClose,
  onDelete,
}: {
  row: Row;
  save: SaveFn;
  preview: Preview;
  onClose: () => void;
  onDelete: () => void;
}) {
  const initial = Object.fromEntries(FIELDS.map((field) => [field, fieldText(row.record, field)])) as Record<
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

  // 邊打邊算：把草稿套到這一筆上，打錯的欄位先當作沒改
  const live = { ...row.record };
  for (const field of FIELDS) {
    const parsed = parseField(field, draft[field]);
    if (parsed.ok) Object.assign(live, parsed.patch);
  }
  live.kg = totalKg(live.planKg, live.guideKg, row.record.planKg === null && row.record.guideKg === null ? row.record.kg : null);
  const c = preview(live);

  const submit = async () => {
    const changed = FIELDS.filter((field) => draft[field] !== initial[field]).map(
      (field) => [field, draft[field]] as [EditableField, string],
    );
    if (!changed.length) return onClose();
    setBusy(true);
    const err = await save(row.record.id, changed);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  const field = (f: EditableField, label: string, opts: { mode?: "numeric" | "decimal" | "tel"; list?: string; big?: boolean; strong?: boolean; placeholder?: string } = {}) => (
    <label className={`flex flex-col gap-1 text-[13px] ${opts.strong ? "font-bold text-brand-700" : "text-muted"}`}>
      {label}
      <input
        value={draft[f]}
        onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
        inputMode={opts.mode}
        list={opts.list}
        placeholder={opts.placeholder}
        className={`${inputBase} font-normal ${opts.big ? "h-[52px] text-right text-xl" : "h-12 text-[17px]"}`}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/40" role="dialog" aria-modal="true" aria-label="編輯公糧">
      <button type="button" className="min-h-10 flex-1" onClick={onClose} aria-label="關閉" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="pb-safe flex max-h-[92dvh] flex-col gap-3.5 overflow-y-auto rounded-t-[20px] bg-white px-4 pb-5 pt-2.5"
      >
        <div className="h-[5px] w-10 self-center rounded-full bg-field" />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">{row.record.name ? "編輯・照核定通知單輸入" : "新增一筆・照核定通知單輸入"}</div>
            <h2 className="truncate text-[22px] font-bold">{draft.name || "（還沒有姓名）"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-[10px] px-3 py-2 text-muted">
            取消
          </button>
        </div>

        <div className="grid grid-cols-[2fr_3fr] gap-2.5">
          {field("fileNo", "檔號", { list: "farmer-file-nos", strong: true, placeholder: "Q11101404" })}
          {field("name", "姓名", { list: "farmer-names" })}
        </div>
        {field("phone", "電話（好幾支用 / 分開）", { mode: "tel" })}
        <div className="grid grid-cols-2 gap-2.5">
          {field("plan", "計畫收購", { mode: "numeric", big: true })}
          {field("guide", "輔導收購", { mode: "numeric", big: true })}
          <div className="flex flex-col gap-1 text-[13px] text-muted">
            公斤（自動）
            <div className="tabular flex h-[52px] items-center justify-end rounded-[10px] bg-brand-100 px-3 text-xl font-bold text-brand-700">
              {fmt(live.kg) || "—"}
            </div>
          </div>
          {field("fen", "分（核定面積）", { mode: "decimal", big: true })}
          {field("deposit", "入簿", { mode: "numeric", big: true, placeholder: "農會撥款後再填" })}
          {field("collect", "收（要填「扣」才改）", { big: true, placeholder: "自動" })}
        </div>

        <section aria-label="即時計算" className="tabular flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
          <div className="flex justify-between text-sm text-ink-2">
            <span>
              利 {fmt(c.interest)} − 運費 {fmt(c.freight)}
            </span>
            <span>先付 {fmt(c.prepaid)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-ink-2">
              {live.planKg !== null || live.guideKg !== null
                ? `公斤 ${fmt(live.planKg ?? 0)} ＋ ${fmt(live.guideKg ?? 0)} ＝ ${fmt(live.kg)}`
                : `公斤 ${fmt(live.kg) || "—"}`}
            </span>
            <span className={`shrink-0 whitespace-nowrap text-base font-bold ${c.collectText ? "text-warn-700" : live.deposit === null ? "text-muted" : "text-brand-700"}`}>
              {c.collectText ? `收：${c.collectText}` : live.deposit === null ? "收：填入簿後計算" : `收 ${fmt(c.collect)}`}
            </span>
          </div>
          <div className="text-xs text-muted">邊打邊算，跟 Excel 同一套公式</div>
        </section>

        <details className="text-sm text-muted" open={!!(initial.code || initial.address)}>
          <summary className="py-1.5">編號、地址</summary>
          <div className="mt-2 grid gap-2.5">
            {field("code", "編號")}
            {field("address", "地址")}
          </div>
        </details>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2.5">
          <button type="button" onClick={onDelete} className="h-[52px] rounded-xl border border-red-200 px-4 text-red-700">
            刪除
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-[52px] flex-1 rounded-xl bg-brand-600 text-[17px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>
    </div>
  );
}

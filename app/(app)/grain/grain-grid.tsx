"use client";

import { Fragment, useEffect } from "react";
import { GridCell, focusCell } from "@/components/grid-cell";
import { ROWS_PER_PAGE } from "@/lib/calc";
import { fieldText, type EditableField } from "@/lib/grain/fields";
import { fmt, type Row, type SaveFn } from "./grain-sheet";

// 電腦版：像 Excel 的表格。
// 方向鍵移動、Enter 往下、Shift+Enter 往上、Esc 取消這一格的修改；離開格子就自動儲存。

type Column =
  | { kind: "edit"; field: EditableField; label: string; width: string; numeric?: boolean; list?: string }
  | { kind: "calc"; key: "interest" | "freight" | "prepaid"; label: string; width: string };

const COLUMNS: Column[] = [
  { kind: "edit", field: "code", label: "編號", width: "w-16" },
  { kind: "edit", field: "name", label: "姓名", width: "min-w-28", list: "farmer-names" },
  { kind: "edit", field: "phone", label: "電話", width: "min-w-48" },
  { kind: "edit", field: "kg", label: "公斤", width: "w-20", numeric: true },
  { kind: "edit", field: "fen", label: "分", width: "w-20", numeric: true },
  { kind: "calc", key: "interest", label: "利", width: "w-20" },
  { kind: "calc", key: "freight", label: "運費", width: "w-20" },
  { kind: "calc", key: "prepaid", label: "先付", width: "w-20" },
  { kind: "edit", field: "deposit", label: "入簿", width: "w-24", numeric: true },
  { kind: "edit", field: "collect", label: "收", width: "w-24", numeric: true },
  { kind: "edit", field: "address", label: "地址", width: "min-w-48" },
];
const EDIT_FIELDS = COLUMNS.filter((c) => c.kind === "edit").map((c) => c.field);

const GRID_ID = "grain";

export function GrainGrid({
  rows,
  save,
  add,
  remove,
  focusId,
  onFocused,
}: {
  rows: Row[];
  save: SaveFn;
  add: () => Promise<unknown>;
  remove: (id: number) => Promise<boolean>;
  focusId: number | null;
  onFocused: () => void;
}) {
  // 新增後把游標放到新那一列的姓名
  useEffect(() => {
    if (focusId === null) return;
    const r = rows.findIndex((row) => row.record.id === focusId);
    if (r >= 0 && focusCell(GRID_ID, r, EDIT_FIELDS.indexOf("name"))) onFocused();
  }, [focusId, rows, onFocused]);

  let pageKg = 0;
  const totalKg = rows.reduce((n, r) => n + (r.record.kg ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
      <table data-grid={GRID_ID} className="tabular w-full border-collapse text-[15px]">
        <thead className="sticky top-0 z-10 bg-[#f1efe8] text-sm">
          <tr>
            <th className="w-10 border-b border-black/10 px-2 py-2 text-black/40">#</th>
            {COLUMNS.map((c) => (
              <th
                key={c.label}
                className={`${c.width} border-b border-l border-black/10 px-2 py-2 font-bold ${c.kind === "calc" ? "text-black/50" : ""}`}
              >
                {c.label}
              </th>
            ))}
            <th className="w-10 border-b border-l border-black/10" aria-label="刪除" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => {
            pageKg += row.record.kg ?? 0;
            const endOfPage = (r + 1) % ROWS_PER_PAGE === 0 && r + 1 < rows.length;
            const subtotal = pageKg;
            if (endOfPage) pageKg = 0;
            return (
              <Fragment key={row.record.id}>
                <tr className="group hover:bg-brand-50/40">
                  <td className="border-b border-black/5 px-2 text-center text-xs text-black/35">
                    {row.saving ? <span className="inline-block size-2 animate-pulse rounded-full bg-brand-500" title="儲存中" /> : r + 1}
                  </td>
                  {COLUMNS.map((c) =>
                    c.kind === "calc" ? (
                      <td key={c.key} className="border-b border-l border-black/5 bg-black/[0.02] px-2 text-right text-black/60">
                        {fmt(row.calc[c.key])}
                      </td>
                    ) : (
                      <td key={c.field} className="border-b border-l border-black/5 p-0">
                        <GridCell
                          gridId={GRID_ID}
                          row={r}
                          col={EDIT_FIELDS.indexOf(c.field)}
                          value={fieldText(row.record, c.field)}
                          placeholder={c.field === "collect" ? fmt(row.calc.collect) : undefined}
                          numeric={c.numeric}
                          list={c.list}
                          label={`第 ${r + 1} 列 ${c.label}`}
                          highlight={c.field === "collect" && row.record.collectOverride !== null}
                          onCommit={(raw) => save(row.record.id, [[c.field, raw]])}
                        />
                      </td>
                    ),
                  )}
                  <td className="border-b border-l border-black/5 text-center">
                    <button
                      type="button"
                      onClick={() => remove(row.record.id)}
                      className="rounded px-2 py-1 text-black/25 opacity-0 hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                      aria-label={`刪除第 ${r + 1} 列`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
                {endOfPage && <SubtotalRow label="本頁小計" kg={subtotal} />}
              </Fragment>
            );
          })}
          {rows.length > 0 && (
            <>
              <SubtotalRow label="本頁小計" kg={pageKg} />
              <SubtotalRow label="總合計" kg={totalKg} />
            </>
          )}
        </tbody>
      </table>
      <div className="border-t border-black/10 p-2">
        <button type="button" onClick={add} className="rounded-lg px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50">
          ＋ 新增一筆
        </button>
        <span className="ml-3 text-xs text-black/40">方向鍵移動・Enter 往下・Esc 取消・離開格子自動儲存</span>
      </div>
    </div>
  );
}

function SubtotalRow({ label, kg }: { label: string; kg: number }) {
  return (
    <tr className="bg-[#f1efe8] font-bold">
      <td />
      <td className="border-l border-black/5" />
      <td className="border-l border-black/5 px-2 py-1.5">{label}</td>
      <td className="border-l border-black/5" />
      <td className="border-l border-black/5 px-2 text-right">{fmt(kg)}</td>
      <td colSpan={8} />
    </tr>
  );
}


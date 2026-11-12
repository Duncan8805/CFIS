"use client";

import { useEffect } from "react";
import { GridCell, focusCell } from "@/components/grid-cell";
import { ROWS_PER_PAGE } from "@/lib/calc";
import { fieldText, splitPhones, type EditableField } from "@/lib/grain/fields";
import { fmt, type Row, type SaveFn } from "./grain-sheet";

// 電腦版：像 Excel 的表格，欄位照農會核定通知單的順序。
// 方向鍵移動、Enter 往下（最後一列再按就新增一筆）、Shift+Enter 往上、Esc 取消；離開格子就自動儲存。

type CalcKey = "kg" | "interest" | "freight" | "prepaid";
type Column =
  | { kind: "edit"; field: EditableField; label: string; sub?: string; numeric?: boolean; list?: string; className?: string }
  | { kind: "calc"; key: CalcKey; label: string; sub?: string };

const COLUMNS: Column[] = [
  { kind: "edit", field: "fileNo", label: "檔號", list: "farmer-file-nos", className: "w-[118px] text-brand-700 font-medium" },
  { kind: "edit", field: "code", label: "編號", className: "w-16 text-faint" },
  { kind: "edit", field: "name", label: "姓名", list: "farmer-names", className: "font-medium" },
  { kind: "edit", field: "phone", label: "電話", className: "text-ink-2" },
  { kind: "edit", field: "fen", label: "分", sub: "核定面積", numeric: true, className: "w-24" },
  { kind: "edit", field: "plan", label: "計畫收購", numeric: true, className: "w-24" },
  { kind: "edit", field: "guide", label: "輔導收購", numeric: true, className: "w-24" },
  { kind: "calc", key: "kg", label: "公斤", sub: "計畫＋輔導" },
  { kind: "calc", key: "interest", label: "利" },
  { kind: "calc", key: "freight", label: "運費" },
  { kind: "calc", key: "prepaid", label: "先付" },
  { kind: "edit", field: "deposit", label: "入簿", numeric: true, className: "w-28" },
  { kind: "edit", field: "collect", label: "收", sub: "可填「扣」", numeric: true, className: "w-28" },
  { kind: "edit", field: "address", label: "地址", className: "min-w-48 text-faint" },
];
const EDIT_FIELDS = COLUMNS.filter((c) => c.kind === "edit").map((c) => c.field);

// 表頭上面一排：說明每一組欄位從哪裡來
const GROUPS: { label: string; span: number; calc?: boolean }[] = [
  { label: "農民", span: 4 },
  { label: "照農會核定通知單輸入", span: 3 },
  { label: "自動計算", span: 4, calc: true },
  { label: "輸入", span: 1 },
  { label: "自動", span: 1, calc: true },
  { label: "", span: 2 },
];
const GROUP_START = new Set([5, 8, 12, 13, 14]); // 這些欄（含 # 欄的索引）左邊畫分隔線

const GRID_ID = "grain";
const cellLine = (i: number) => (GROUP_START.has(i) ? "border-l border-line-soft" : "");

function calcValue(row: Row, key: CalcKey) {
  return key === "kg" ? row.record.kg : row.calc[key];
}

export function GrainGrid({
  rows,
  filtered,
  save,
  add,
  remove,
  focusId,
  onFocused,
}: {
  rows: Row[];
  /** 正在搜尋：合計列只算顯示出來的 */
  filtered: boolean;
  save: SaveFn;
  add: () => Promise<unknown>;
  remove: (id: number) => Promise<boolean>;
  focusId: number | null;
  onFocused: () => void;
}) {
  // 新增後把游標放到新那一列的檔號（照通知單從檔號開始打）
  useEffect(() => {
    if (focusId === null) return;
    const r = rows.findIndex((row) => row.record.id === focusId);
    if (r >= 0 && focusCell(GRID_ID, r, EDIT_FIELDS.indexOf("fileNo"))) onFocused();
  }, [focusId, rows, onFocused]);

  const sum = (pick: (r: Row) => number | null) => rows.reduce((n, r) => n + (pick(r) ?? 0), 0);
  const anySplit = rows.some((r) => r.record.planKg !== null || r.record.guideKg !== null);

  return (
    <section aria-label="公糧表" className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="overflow-x-auto">
        <table data-grid={GRID_ID} className="tabular w-full min-w-[1320px] border-collapse whitespace-nowrap text-[15px]">
          <thead>
            <tr className="bg-panel text-xs text-muted">
              <th />
              {GROUPS.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className={`px-3 pt-1.5 text-left font-medium ${i > 0 ? "border-l border-line-soft" : ""} ${g.calc ? "bg-head" : ""}`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className="border-b border-line bg-panel text-sm text-ink-2">
              <th className="w-9 px-2 pb-2.5 pt-1.5 font-medium text-faint">#</th>
              {COLUMNS.map((c, i) => {
                const calc = c.kind === "calc" || (c.kind === "edit" && c.field === "collect");
                return (
                  <th
                    key={c.label}
                    className={`px-3 pb-2.5 pt-1.5 align-bottom ${cellLine(i + 1)} ${
                      (c.kind === "edit" && c.numeric) || c.kind === "calc" ? "text-right" : "text-left"
                    } ${calc ? "bg-head" : ""} ${
                      c.kind === "calc" && c.key !== "kg" ? "font-medium text-muted" : "font-bold"
                    } ${c.kind === "edit" && (c.field === "fileNo" || c.field === "collect") ? "text-brand-700" : ""}`}
                  >
                    {c.label}
                    {c.sub && <div className="text-[11px] font-normal text-faint">{c.sub}</div>}
                  </th>
                );
              })}
              <th className="w-10 border-l border-line-soft" aria-label="刪除" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.record.id} className="group border-t border-line-soft hover:bg-brand-50/60">
                <td className="px-2 text-center text-xs text-faint">
                  {row.saving ? <span className="inline-block size-2 animate-pulse rounded-full bg-brand-500" title="儲存中" /> : r + 1}
                </td>
                {COLUMNS.map((c, i) => {
                  if (c.kind === "calc") {
                    const v = calcValue(row, c.key);
                    return (
                      <td
                        key={c.key}
                        className={`bg-calc px-3 text-right ${cellLine(i + 1)} ${c.key === "kg" ? "font-medium text-ink" : "text-muted"}`}
                      >
                        {fmt(v)}
                      </td>
                    );
                  }
                  const { field } = c;
                  const value = fieldText(row.record, field);
                  const split = field === "plan" || field === "guide";
                  // 舊 Excel 匯入、只有公斤的資料：計畫／輔導顯示「—」
                  const placeholder =
                    field === "collect"
                      ? row.record.deposit === null
                        ? "—"
                        : fmt(row.calc.collect)
                      : split && row.record.planKg === null && row.record.guideKg === null && row.record.kg !== null
                        ? "—"
                        : undefined;
                  return (
                    <td
                      key={field}
                      className={`p-0 ${cellLine(i + 1)} ${field === "collect" ? "bg-brand-50 font-bold text-brand-700" : ""} ${c.className ?? ""}`}
                    >
                      <GridCell
                        gridId={GRID_ID}
                        row={r}
                        col={EDIT_FIELDS.indexOf(field)}
                        value={value}
                        placeholder={placeholder}
                        numeric={c.numeric}
                        list={c.list}
                        label={`第 ${r + 1} 列 ${c.label}`}
                        highlight={field === "collect" && row.record.collectOverride !== null}
                        display={
                          field === "phone" ? (
                            splitPhones(row.record.phone).map((p, k) => <div key={k}>{p}</div>)
                          ) : field === "name" ? (
                            value || " "
                          ) : undefined
                        }
                        onPastEnd={r === rows.length - 1 && !filtered ? add : undefined}
                        onCommit={(raw) => save(row.record.id, [[field, raw]])}
                      />
                    </td>
                  );
                })}
                <td className="border-l border-line-soft text-center">
                  <button
                    type="button"
                    onClick={() => remove(row.record.id)}
                    className="rounded px-2 py-1 text-ghost opacity-0 hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                    aria-label={`刪除第 ${r + 1} 列`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-line-soft">
              <td />
              <td colSpan={COLUMNS.length + 1} className="px-3 py-2.5">
                <button type="button" onClick={add} className="font-bold text-brand-600 hover:text-brand-700">
                  ＋ 新增一筆
                </button>
                <span className="ml-3 text-[13px] text-faint">或在最後一列按 Enter</span>
              </td>
            </tr>
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-field bg-head font-bold">
                <td />
                <td colSpan={4} className="px-3 py-3">
                  {filtered ? "搜尋結果合計" : "總合計"}
                  <span className="ml-3 text-[13px] font-normal text-muted">
                    {rows.length} 筆{!filtered && `・${Math.ceil(rows.length / ROWS_PER_PAGE)} 頁`}
                  </span>
                </td>
                <td />
                {[sum((r) => r.record.planKg), sum((r) => r.record.guideKg)].map((v, i) => (
                  <td key={i} className={`px-3 text-right ${anySplit ? "" : "font-normal text-ghost"}`}>
                    {anySplit ? fmt(v) : "—"}
                  </td>
                ))}
                <td className="px-3 text-right">{fmt(sum((r) => r.record.kg))}</td>
                <td className="px-3 text-right">{fmt(sum((r) => r.calc.interest))}</td>
                <td className="px-3 text-right">{fmt(sum((r) => r.calc.freight))}</td>
                <td className="px-3 text-right">{fmt(sum((r) => r.calc.prepaid))}</td>
                <td className="px-3 text-right">{fmt(sum((r) => r.record.deposit))}</td>
                <td className="px-3 text-right text-brand-700">
                  {fmt(sum((r) => (r.record.deposit === null ? 0 : r.calc.collect)))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

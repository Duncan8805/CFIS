"use client";

import { Fragment } from "react";
import { GridCell } from "@/components/grid-cell";
import { ROWS_PER_PAGE } from "@/lib/calc";
import { weeklyFieldText, type WeeklyField } from "@/lib/weekly/fields";
import { fmt, type WeeklySaveFn, type WRow } from "./weekly-sheet";

// 電腦版週報表。欄位順序跟 Excel 一樣；姓名、公斤從公糧帶入不能改。

const GRID_ID = "weekly";

type Column =
  | { kind: "edit"; field: WeeklyField; label: string; width: string; numeric?: boolean; placeholder?: string }
  | { kind: "info"; key: "name" | "kg" | "wet" | "rate"; label: string; width: string; printHidden?: boolean };

const COLUMNS: Column[] = [
  { kind: "edit", field: "intakeDate", label: "濕穀進儲日期", width: "w-28 min-w-28", placeholder: "例：6/28" },
  { kind: "info", key: "name", label: "繳穀農民", width: "min-w-28" },
  { kind: "info", key: "kg", label: "公斤", width: "w-20 min-w-20", printHidden: true },
  { kind: "info", key: "wet", label: "濕稻穀數量", width: "w-24 min-w-24" },
  { kind: "edit", field: "moisture", label: "水分", width: "w-16 min-w-16", numeric: true },
  { kind: "info", key: "rate", label: "濕稻穀折算", width: "w-20 min-w-20", printHidden: true },
  { kind: "edit", field: "sellTo", label: "預計繳售公糧業者名稱", width: "w-36 min-w-36" },
  { kind: "edit", field: "plannedSellDate", label: "預定繳售日期", width: "w-28 min-w-28" },
  { kind: "edit", field: "remark", label: "備註", width: "min-w-56" },
];
const EDIT_FIELDS = COLUMNS.filter((c) => c.kind === "edit").map((c) => c.field);

function infoValue(r: WRow, key: "name" | "kg" | "wet" | "rate") {
  switch (key) {
    case "name":
      return r.row.name;
    case "kg":
      return fmt(r.row.kg);
    case "wet":
      return fmt(r.wetQuantity);
    case "rate":
      return r.rate ? String(r.rate) : "";
  }
}

export function WeeklyGrid({ rows, save, printMode }: { rows: WRow[]; save: WeeklySaveFn; printMode: boolean }) {
  const columns = COLUMNS.filter((c) => !(printMode && c.kind === "info" && c.printHidden));
  let pageKg = 0;
  let pageWet = 0;

  const subtotal = (label: string, kg: number, wet: number) => (
    <tr className="bg-head font-bold">
      <td className="border border-line" />
      {columns.map((c, i) => (
        <td key={i} className="tabular border border-line px-2 py-2 text-right">
          {c.kind === "info" && c.key === "name" ? <span className="block text-left font-sans">{label}</span> : null}
          {c.kind === "info" && c.key === "kg" ? fmt(kg) : null}
          {c.kind === "info" && c.key === "wet" ? fmt(wet) : null}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
      <table data-grid={GRID_ID} className="w-full min-w-[1040px] border-collapse text-[15px]">
        <thead className="bg-head text-[15px]">
          <tr className="border-b-2 border-line">
            <th className="w-10 border border-line-soft px-1 py-2 text-[13px] font-medium text-muted">#</th>
            {columns.map((c) => (
              <th
                key={c.label}
                className={`${c.width} border border-line-soft px-2 py-2 text-left font-bold ${c.kind === "info" ? "bg-line-soft text-ink-2" : "text-ink"}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            pageKg += r.row.kg ?? 0;
            pageWet += r.wetQuantity ?? 0;
            const endOfPage = (i + 1) % ROWS_PER_PAGE === 0 && i + 1 < rows.length;
            const sub = [pageKg, pageWet] as const;
            if (endOfPage) pageKg = pageWet = 0;
            return (
              <Fragment key={r.row.entryId}>
                <tr className="hover:bg-brand-50/40">
                  <td className="tabular border border-line-soft bg-panel px-1 text-center text-[13px] text-muted">
                    {r.saving ? <span className="inline-block size-2 animate-pulse rounded-full bg-brand-500" title="儲存中" /> : i + 1}
                  </td>
                  {columns.map((c) =>
                    c.kind === "info" ? (
                      <td
                        key={c.key}
                        className={`border border-line-soft bg-calc px-2 ${c.key === "name" ? "" : "tabular text-right"} ${
                          c.key === "name" ? "text-ink" : "text-ink-2"
                        }`}
                      >
                        {infoValue(r, c.key)}
                      </td>
                    ) : (
                      <td key={c.field} className={`border border-line-soft p-0 ${c.field === "sellTo" || c.field === "remark" ? "" : "tabular"}`}>
                        <GridCell
                          gridId={GRID_ID}
                          row={i}
                          col={EDIT_FIELDS.indexOf(c.field)}
                          value={weeklyFieldText(r.row, c.field, r.defaults)}
                          placeholder={c.placeholder}
                          numeric={c.numeric}
                          label={`第 ${i + 1} 列 ${c.label}`}
                          highlight={
                            (c.field === "sellTo" && r.row.sellToOverride !== null) ||
                            (c.field === "remark" && r.row.remarkOverride !== null)
                          }
                          onCommit={(raw) => save(r.row.entryId, [[c.field, raw]])}
                        />
                      </td>
                    ),
                  )}
                </tr>
                {endOfPage && subtotal("本頁小計", sub[0], sub[1])}
              </Fragment>
            );
          })}
          {subtotal("本頁小計", pageKg, pageWet)}
          {subtotal(
            "總合計",
            rows.reduce((n, r) => n + (r.row.kg ?? 0), 0),
            rows.reduce((n, r) => n + (r.wetQuantity ?? 0), 0),
          )}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2.5 text-[14px] leading-relaxed text-muted">
        日期可以打 6/28 或 0628・橘色字是跟收購點預設不同的內容・方向鍵移動、Enter 往下、離開格子自動儲存・紅框是沒存到的格子：改好後按 Enter 再存一次，或按 Esc 恢復原本的值
      </p>
    </div>
  );
}


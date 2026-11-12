"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/page-header";

const fmt = (n: number, digits = 0) => n.toLocaleString("zh-TW", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClass.secondary} no-print`}>
      列印
    </button>
  );
}

export interface TrendPoint {
  label: string;
  kg: number;
  deposit: number;
  collect: number;
  freight: number;
  perKg: number;
}

const METRICS = [
  { key: "kg", label: "公斤", format: (n: number) => fmt(n) },
  { key: "deposit", label: "入簿", format: (n: number) => fmt(n) },
  { key: "collect", label: "收", format: (n: number) => fmt(n) },
  { key: "freight", label: "運費", format: (n: number) => fmt(n) },
  { key: "perKg", label: "入簿／公斤", format: (n: number) => fmt(n, 2) },
] as const;

/** 歷期趨勢：每一期一根長條，可以切換看哪個數字 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("kg");
  const m = METRICS.find((x) => x.key === metric)!;
  const max = Math.max(1, ...points.map((p) => p[metric]));
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="trend-h" className="flex-1 text-[16px] font-bold">
          歷期趨勢
        </h2>
        <div role="group" aria-label="指標" className="flex flex-wrap gap-1.5">
          {METRICS.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={metric === x.key}
              onClick={() => setMetric(x.key)}
              className={`min-h-10 rounded-[4px] border px-3.5 text-[15px] ${
                metric === x.key ? "border-brand-600 bg-brand-600 font-bold text-white" : "border-field bg-white text-ink-2"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-max items-end gap-4" style={{ height: 200 }}>
          {points.map((p, i) => {
            const last = i === points.length - 1;
            const prev = points[i - 1];
            const change = prev && prev[metric] ? (p[metric] - prev[metric]) / prev[metric] : null;
            return (
              <div key={p.label} className="flex w-20 flex-col items-center justify-end gap-1 self-stretch">
                <span className="tabular text-[13px] font-bold text-ink">{m.format(p[metric])}</span>
                {change !== null && (
                  <span className={`tabular text-[13px] ${change >= 0 ? "text-brand-700" : "text-warn-700"}`}>
                    {change >= 0 ? "▲" : "▼"} {fmt(Math.abs(change) * 100, 1)}%
                  </span>
                )}
                <div
                  className={`w-14 rounded-t-[2px] ${last ? "bg-brand-600" : "bg-brand-200"}`}
                  style={{ height: `${Math.max(2, Math.round((p[metric] / max) * 150))}px` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex min-w-max gap-4 border-t border-line pt-1.5">
          {points.map((p) => (
            <span key={p.label} className="w-20 text-center text-[13px] text-muted">
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export interface SiteRow {
  id: number;
  name: string;
  kg: number;
  share: number;
  deposit: number | null;
  collect: number | null;
  freight: number;
  perKg: number | null;
  low: boolean;
  collectText: number;
  depositMissing: number;
}

type SortKey = "name" | "kg" | "deposit" | "collect" | "freight" | "perKg";

/** 各收購點：點欄位名稱排序 */
export function SiteTable({
  rows,
  totals,
}: {
  rows: SiteRow[];
  totals: { kg: number; deposit: number; collect: number; freight: number; perKg: number };
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "kg", desc: true });
  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key] ?? -Infinity;
    const bv = b[sort.key] ?? -Infinity;
    const c = typeof av === "string" ? av.localeCompare(String(bv), "zh-TW") : (av as number) - (bv as number);
    return sort.desc ? -c : c;
  });
  const head = (key: SortKey, label: string, right = true) => (
    <th className={`px-3 py-1 font-bold ${right ? "text-right" : "text-left"}`} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }))}
        className="min-h-10 hover:text-brand-700"
      >
        {label}
        {sort.key === key && (sort.desc ? " ▾" : " ▴")}
      </button>
    </th>
  );
  const money = (n: number | null) => (n === null ? <span className="font-sans text-muted">未填</span> : fmt(n));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse whitespace-nowrap text-[15px] [&_td]:border [&_td]:border-line-soft [&_th]:border [&_th]:border-line-soft">
        <thead>
          <tr className="border-b-2 border-line bg-head text-[15px] text-ink-2">
            <th className="px-3 py-1 text-left font-bold">
              <button type="button" onClick={() => setSort((s) => ({ key: "name", desc: s.key === "name" ? !s.desc : false }))} className="min-h-10 hover:text-brand-700">
                收購點{sort.key === "name" && (sort.desc ? " ▾" : " ▴")}
              </button>
            </th>
            {head("kg", "公斤")}
            <th className="px-3 py-2 text-left font-bold">佔全期</th>
            {head("deposit", "入簿")}
            {head("collect", "收")}
            {head("freight", "運費")}
            {head("perKg", "入簿／公斤")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 font-medium">
                <Link href={`/grain?site=${r.id}`} className="hover:text-brand-700">
                  {r.name}
                </Link>
              </td>
              <td className="tabular px-3 py-2 text-right">{fmt(r.kg)}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden bg-line-soft">
                    <div className="h-full bg-brand-600" style={{ width: `${Math.round(r.share * 100)}%` }} />
                  </div>
                  <span className="tabular text-[14px] text-ink-2">{fmt(r.share * 100, 1)}%</span>
                </div>
              </td>
              <td className="tabular px-3 py-2 text-right">{money(r.deposit)}</td>
              <td className="tabular px-3 py-2 text-right">{money(r.collect)}</td>
              <td className="tabular px-3 py-2 text-right">{fmt(r.freight)}</td>
              <td className={`tabular px-3 py-2 text-right ${r.low ? "bg-warn-50 font-bold text-warn-700" : ""}`}>
                {r.perKg === null ? <span className="text-muted">—</span> : fmt(r.perKg, 2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-head font-bold [&>td]:!border-line">
            <td className="px-3 py-2">合計</td>
            <td className="tabular px-3 py-2 text-right">{fmt(totals.kg)}</td>
            <td className="tabular px-3 py-2">100%</td>
            <td className="tabular px-3 py-2 text-right">{fmt(totals.deposit)}</td>
            <td className="tabular px-3 py-2 text-right">{fmt(totals.collect)}</td>
            <td className="tabular px-3 py-2 text-right">{fmt(totals.freight)}</td>
            <td className="tabular px-3 py-2 text-right">{fmt(totals.perKg, 2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

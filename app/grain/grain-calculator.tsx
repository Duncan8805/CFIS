"use client";

import { useState } from "react";
import { calcGrain, calcWeekly, type RoundingMode } from "@/lib/calc";

const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString("zh-TW", { maximumFractionDigits: 2 }));
const parse = (s: string) => (s.trim() === "" ? null : Number(s));

// 試算：預設帶入東石珍第 1 筆（1304 公斤、0.4012 分、入簿 36512、水分 26）
export function GrainCalculator() {
  const [kg, setKg] = useState("1304");
  const [fen, setFen] = useState("0.4012");
  const [deposit, setDeposit] = useState("36512");
  const [moisture, setMoisture] = useState("26");
  const [mode, setMode] = useState<RoundingMode>("truncate");

  const g = calcGrain({ kg: parse(kg), fen: parse(fen), deposit: parse(deposit) }, undefined, mode);
  const w = calcWeekly({ kg: parse(kg), moisture: parse(moisture) });

  const inputs: [string, string, (v: string) => void, "numeric" | "decimal"][] = [
    ["公斤", kg, setKg, "numeric"],
    ["分", fen, setFen, "decimal"],
    ["入簿", deposit, setDeposit, "numeric"],
    ["水分", moisture, setMoisture, "numeric"],
  ];
  const results: [string, number | null][] = [
    ["利", g.interest],
    ["運費", g.freight],
    ["先付", g.prepaid],
    ["收", g.collect],
    ["濕稻穀折算", w.rate],
    ["濕稻穀數量", w.wetQuantity],
  ];

  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-bold">試算</h2>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-brand-600"
            checked={mode === "truncate"}
            onChange={(e) => setMode(e.target.checked ? "truncate" : "none")}
          />
          利、運費無條件捨去
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {inputs.map(([label, value, set, inputMode]) => (
          <label key={label} className="flex flex-col gap-1 text-sm">
            <span className="text-black/60">{label}</span>
            <input
              inputMode={inputMode}
              value={value}
              onChange={(e) => set(e.target.value)}
              className="tabular rounded-lg border border-black/20 px-3 py-2 text-right text-lg focus:border-brand-500 focus:outline-none"
            />
          </label>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {results.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-brand-50 px-3 py-2">
            <dt className="text-xs text-black/60">{label}</dt>
            <dd className="tabular text-right text-lg font-bold">{fmt(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { GrainRates } from "@/lib/calc";
import { breakEvenFreight, simulatePrepaid, type PrepaidRow } from "@/lib/calc/prepaid";
import { inputClass } from "../settings/ui";

const fmt = (n: number, digits = 0) => n.toLocaleString("zh-TW", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n: number) => (Math.round(n) === 0 ? "±0" : `${n > 0 ? "+" : "−"}${fmt(Math.abs(n))}`);

function parseRate(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

export function PrepaidSimulator({
  rows,
  sites,
  rates,
  planNote,
}: {
  rows: PrepaidRow[];
  sites: { id: number; name: string }[];
  /** 這一期現行的每分利、每公斤運費 */
  rates: GrainRates;
  /** 估算公斤用的每公頃收購量說明；這一期沒設定時為 null */
  planNote: string | null;
}) {
  const [interestText, setInterestText] = useState(String(rates.interestPerFen));
  const [freightText, setFreightText] = useState(String(rates.freightPerKg));
  const interest = parseRate(interestText);
  const freight = parseRate(freightText);
  const simRates: GrainRates = {
    interestPerFen: interest ?? rates.interestPerFen,
    freightPerKg: freight ?? rates.freightPerKg,
  };
  const changed = simRates.interestPerFen !== rates.interestPerFen || simRates.freightPerKg !== rates.freightPerKg;

  const base = useMemo(() => simulatePrepaid(rows, rates), [rows, rates]);
  const sim = useMemo(
    () => simulatePrepaid(rows, simRates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, simRates.interestPerFen, simRates.freightPerKg],
  );
  const b = base.totals;
  const s = sim.totals;
  const breakEven = breakEvenFreight(s);

  const siteRows = sites
    .map((site) => ({ site, base: base.bySite.get(site.id), sim: sim.bySite.get(site.id) }))
    .filter((r): r is { site: typeof r.site; base: NonNullable<typeof r.base>; sim: NonNullable<typeof r.sim> } => !!r.base && !!r.sim)
    .sort((x, y) => y.sim.prepaid - x.sim.prepaid);

  const delta = (now: number, was: number) =>
    changed ? <span className={`tabular text-[13px] ${now - was > 0 ? "text-warn-700" : "text-brand-700"}`}>比現行 {signed(now - was)}</span> : null;

  const kpis = [
    { label: "先付資金需求", value: s.prepaid, was: b.prepaid, sub: "利 − 運費，繳售前要先拿出去的錢", brand: true },
    { label: "利", value: s.interest, was: b.interest, sub: `分 × 每分利 ${fmt(simRates.interestPerFen)}` },
    { label: "運費", value: s.freight, was: b.freight, sub: `公斤 × 每公斤 ${fmt(simRates.freightPerKg, 2)}` },
    { label: "收（應收）", value: s.collect, was: b.collect, sub: "入簿 − 先付，只算已填入簿的" },
  ];

  if (!rows.length) {
    return (
      <>
        <h2 id="prepaid-h" className="text-[16px] font-bold">
          先付資金試算
        </h2>
        <p className="mt-2 text-[15px] text-muted">這一期還沒有公糧紀錄。</p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="prepaid-h" className="text-[16px] font-bold">
          先付資金試算
        </h2>
        <span className="text-[13px] text-muted">只是試算，不會改到任何資料或設定</span>
      </div>
      <p className="text-[13px] text-muted">改每分利或每公斤運費，看這一期要準備的先付資金、各收購點的金額會怎麼變。</p>

      <div className="mt-3 flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex w-40 flex-col gap-1 text-[15px]">
          <span className="text-ink-2">每分利</span>
          <input
            className={`${inputClass} tabular text-right ${interest === null ? "border-red-600" : ""}`}
            inputMode="decimal"
            value={interestText}
            aria-invalid={interest === null}
            onChange={(e) => setInterestText(e.target.value)}
          />
        </label>
        <label className="flex w-40 flex-col gap-1 text-[15px]">
          <span className="text-ink-2">每公斤運費</span>
          <input
            className={`${inputClass} tabular text-right ${freight === null ? "border-red-600" : ""}`}
            inputMode="decimal"
            value={freightText}
            aria-invalid={freight === null}
            onChange={(e) => setFreightText(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!changed && interest !== null && freight !== null}
          onClick={() => {
            setInterestText(String(rates.interestPerFen));
            setFreightText(String(rates.freightPerKg));
          }}
          className="min-h-11 rounded-[4px] border border-field bg-white px-4 text-[15px] text-ink hover:border-brand-600 disabled:cursor-default disabled:text-muted disabled:hover:border-field"
        >
          回到現行（{fmt(rates.interestPerFen)}／{fmt(rates.freightPerKg, 2)}）
        </button>
      </div>
      {(interest === null || freight === null) && <p className="mt-1 text-[14px] text-red-700">請輸入 0 以上的數字；先用現行數值計算。</p>}

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line-soft lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex min-w-0 flex-col gap-0.5 bg-white px-4 py-3">
            <span className="text-[14px] text-muted">{k.label}</span>
            <span className={`tabular truncate text-xl font-semibold ${k.brand ? "text-brand-700" : "text-ink"}`}>NT$ {fmt(k.value)}</span>
            {delta(k.value, k.was)}
            <span className="truncate text-[13px] text-muted">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-1 text-[14px] text-ink-2">
        {breakEven !== null && (
          <span>
            照目前的公斤與面積，每公斤運費超過 <b className="tabular">{fmt(breakEven, 2)}</b> 元時，運費會把利全部吃掉（先付變 0）。
          </span>
        )}
        {s.estimatedCount > 0 && (
          <span className="text-warn-700">
            其中 {fmt(s.estimatedCount)} 筆還沒填公斤，先用核定面積估算（{planNote}），共約 {fmt(s.estimatedKg)} 公斤；實際數字填進去後會更準。
          </span>
        )}
        {s.estimatedCount === 0 && !planNote && b.kg === 0 && (
          <span>這一期還沒填公斤，也沒有設定每公頃收購量，運費先算 0。到「設定 → 計算」填每公頃收購量，就能用面積先估。</span>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="tabular w-full min-w-[560px] text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-[14px] text-ink-2">
              <th className="py-2 pr-3 font-sans font-medium">收購點</th>
              <th className="py-2 pr-3 text-right font-sans font-medium">公斤</th>
              {changed && <th className="py-2 pr-3 text-right font-sans font-medium">先付（現行）</th>}
              <th className="py-2 pr-3 text-right font-sans font-medium">{changed ? "先付（試算）" : "先付"}</th>
              {changed && <th className="py-2 pr-3 text-right font-sans font-medium">差額</th>}
              <th className="py-2 text-right font-sans font-medium">佔資金</th>
            </tr>
          </thead>
          <tbody>
            {siteRows.map((r) => (
              <tr key={r.site.id} className="border-b border-line-soft">
                <td className="py-1.5 pr-3 font-sans">
                  {r.site.name}
                  {r.sim.estimatedCount > 0 && <span className="ml-1 text-[13px] text-warn-700">含估算</span>}
                </td>
                <td className="py-1.5 pr-3 text-right">{fmt(r.sim.kg)}</td>
                {changed && <td className="py-1.5 pr-3 text-right text-muted">{fmt(r.base.prepaid)}</td>}
                <td className="py-1.5 pr-3 text-right">{fmt(r.sim.prepaid)}</td>
                {changed && <td className="py-1.5 pr-3 text-right">{signed(r.sim.prepaid - r.base.prepaid)}</td>}
                <td className="py-1.5 text-right">{s.prepaid ? `${fmt((r.sim.prepaid / s.prepaid) * 100, 1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-3 font-sans">合計</td>
              <td className="py-2 pr-3 text-right">{fmt(s.kg)}</td>
              {changed && <td className="py-2 pr-3 text-right text-muted">{fmt(b.prepaid)}</td>}
              <td className="py-2 pr-3 text-right">{fmt(s.prepaid)}</td>
              {changed && <td className="py-2 pr-3 text-right">{signed(s.prepaid - b.prepaid)}</td>}
              <td className="py-2 text-right">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCalcSettings, saveMoistureRates } from "@/app/actions/settings";
import type { CalcSettings } from "@/lib/data/settings";
import { Field, inputClass, SaveButton, Section, useSave } from "./ui";

export function SettingsCalc({ settings }: { settings: CalcSettings }) {
  return (
    <Section
      id="calc"
      title="計算參數"
      description="改了之後，公糧、週報表、收款單都會用新的數字重新計算（包含已經輸入的資料）。"
    >
      <div className="flex flex-col gap-6">
        <CalcForm settings={settings} />
        <MoistureTable rows={settings.moistureRates} />
      </div>
    </Section>
  );
}

function CalcForm({ settings }: { settings: CalcSettings }) {
  const router = useRouter();
  const initial = {
    interestPerFen: String(settings.rates.interestPerFen),
    freightPerKg: String(settings.rates.freightPerKg),
    vendorName: settings.vendorName,
  };
  const [form, setForm] = useState(initial);
  const { status, run } = useSave();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = () =>
    run(async () => {
      const interestPerFen = Number(form.interestPerFen);
      const freightPerKg = Number(form.freightPerKg);
      if (!Number.isFinite(interestPerFen) || !Number.isFinite(freightPerKg)) return "請填數字";
      if (!confirm("改了之後，所有公糧資料的利、運費、先付、收都會依新數字重算。確定嗎？")) return "已取消";
      const r = await saveCalcSettings({ interestPerFen, freightPerKg, vendorName: form.vendorName });
      if (!r.ok) return r.error;
      setForm({ interestPerFen: String(interestPerFen), freightPerKg: String(freightPerKg), vendorName: form.vendorName.trim() });
      router.refresh();
      return null;
    });

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="每分利（利 = 分 × 這個數字）">
          <input
            className={`${inputClass} tabular text-right`}
            inputMode="decimal"
            value={form.interestPerFen}
            onChange={(e) => setForm({ ...form, interestPerFen: e.target.value })}
          />
        </Field>
        <Field label="每公斤運費（運費 = 公斤 × 這個數字）">
          <input
            className={`${inputClass} tabular text-right`}
            inputMode="decimal"
            value={form.freightPerKg}
            onChange={(e) => setForm({ ...form, freightPerKg: e.target.value })}
          />
        </Field>
        <Field label="週報表上的繳交業者">
          <input className={inputClass} value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <SaveButton status={status} dirty={dirty} onClick={save} />
      </div>
    </div>
  );
}

function MoistureTable({ rows }: { rows: { moisture: number; rate: number }[] }) {
  const router = useRouter();
  const initial = rows.map((r) => ({ moisture: String(r.moisture), rate: String(r.rate) }));
  const [form, setForm] = useState(initial);
  const { status, run } = useSave();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const update = (i: number, key: "moisture" | "rate", value: string) =>
    setForm((f) => f.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const save = () =>
    run(async () => {
      const parsed = form.map((r) => ({ moisture: Number(r.moisture), rate: Number(r.rate) }));
      if (parsed.some((r) => !Number.isFinite(r.moisture) || !Number.isFinite(r.rate) || r.moisture === 0)) return "請填數字";
      const sorted = parsed.sort((a, b) => a.moisture - b.moisture);
      const r = await saveMoistureRates(sorted);
      if (!r.ok) return r.error;
      // 統一成資料庫的寫法（0.70 → 0.7），儲存後才不會一直顯示「有修改」
      setForm(sorted.map((x) => ({ moisture: String(x.moisture), rate: String(x.rate) })));
      router.refresh();
      return null;
    });

  return (
    <div>
      <h3 className="font-bold">水分折算率</h3>
      <p className="mt-1 text-sm text-black/55">
        濕稻穀數量 = 公斤 ÷ 折算率。水分低於最小那一列時折算率為 0（週報表濕穀數量留白）；水分介於兩列之間時用較小那一列。
      </p>
      <table className="tabular mt-3 w-full max-w-sm text-sm">
        <thead>
          <tr className="text-black/55">
            <th className="pb-1 text-left font-normal">水分（%）</th>
            <th className="pb-1 text-left font-normal">折算率</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {form.map((r, i) => (
            <tr key={i}>
              <td className="py-1 pr-2">
                <input
                  aria-label={`第 ${i + 1} 列水分`}
                  className={`${inputClass} text-right`}
                  inputMode="numeric"
                  value={r.moisture}
                  onChange={(e) => update(i, "moisture", e.target.value)}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`第 ${i + 1} 列折算率`}
                  className={`${inputClass} text-right`}
                  inputMode="decimal"
                  value={r.rate}
                  onChange={(e) => update(i, "rate", e.target.value)}
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => setForm((f) => f.filter((_, j) => j !== i))}
                  aria-label={`刪除第 ${i + 1} 列`}
                  className="rounded px-2 py-1 text-black/35 hover:bg-red-50 hover:text-red-700"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setForm((f) => [...f, { moisture: "", rate: "" }])}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm"
        >
          ＋ 加一列
        </button>
        <SaveButton status={status} dirty={dirty} onClick={save} />
      </div>
    </div>
  );
}

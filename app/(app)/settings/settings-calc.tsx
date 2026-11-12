"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePeriodCalc, savePeriodMoisture } from "@/app/actions/periods";
import { saveVendorName } from "@/app/actions/settings";
import type { CalcSettings } from "@/lib/data/settings";
import { Field, inputClass, SaveButton, Section, useSave } from "./ui";

export function SettingsCalc({ settings, periodLabel }: { settings: CalcSettings; periodLabel: string }) {
  return (
    <Section
      id="calc"
      title={`計算參數：${periodLabel}`}
      description="計算參數每一期各一組，這裡改的是正在看的這一期；其他期別不受影響。改了之後，這一期的公糧、週報表、收款單都會用新的數字重新計算（包含已經輸入的資料）。"
    >
      <div className="flex flex-col gap-6">
        <CalcForm settings={settings} />
        <MoistureTable rows={settings.moistureRates} />
        <VendorForm vendorName={settings.vendorName} />
      </div>
    </Section>
  );
}

const numText = (n: number | null) => (n === null ? "" : String(n));

function CalcForm({ settings }: { settings: CalcSettings }) {
  const router = useRouter();
  const initial = {
    interestPerFen: String(settings.rates.interestPerFen),
    freightPerKg: String(settings.rates.freightPerKg),
    planKgPerHa: numText(settings.planKgPerHa),
    guideKgPerHa: numText(settings.guideKgPerHa),
  };
  const [form, setForm] = useState(initial);
  const { status, run } = useSave();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const save = () =>
    run(async () => {
      const interestPerFen = Number(form.interestPerFen);
      const freightPerKg = Number(form.freightPerKg);
      const optionalInt = (s: string) => (s.trim() === "" ? null : Number(s.replace(/,/g, "")));
      const planKgPerHa = optionalInt(form.planKgPerHa);
      const guideKgPerHa = optionalInt(form.guideKgPerHa);
      if ([interestPerFen, freightPerKg, planKgPerHa ?? 0, guideKgPerHa ?? 0].some((n) => !Number.isFinite(n))) return "請填數字";
      if (
        (form.interestPerFen !== initial.interestPerFen || form.freightPerKg !== initial.freightPerKg) &&
        !confirm("改了之後，這一期所有公糧資料的利、運費、先付、收都會依新數字重算。確定嗎？")
      ) {
        return "已取消";
      }
      const r = await savePeriodCalc({ interestPerFen, freightPerKg, planKgPerHa, guideKgPerHa });
      if (!r.ok) return r.error;
      setForm({
        interestPerFen: String(interestPerFen),
        freightPerKg: String(freightPerKg),
        planKgPerHa: numText(planKgPerHa),
        guideKgPerHa: numText(guideKgPerHa),
      });
      router.refresh();
      return null;
    });

  const numberInput = (key: keyof typeof form, mode: "decimal" | "numeric", placeholder?: string) => (
    <input className={`${inputClass} tabular text-right`} inputMode={mode} value={form[key]} placeholder={placeholder} onChange={set(key)} />
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="每分利（利 = 分 × 這個數字）">{numberInput("interestPerFen", "decimal")}</Field>
        <Field label="每公斤運費（運費 = 公斤 × 這個數字）">{numberInput("freightPerKg", "decimal")}</Field>
        <Field label="每公頃計畫收購（公斤）">{numberInput("planKgPerHa", "numeric", "例：2500")}</Field>
        <Field label="每公頃輔導收購（公斤）">{numberInput("guideKgPerHa", "numeric", "例：1900")}</Field>
      </div>
      <p className="mt-2 text-sm text-muted">
        每公頃的數量照農會核定通知單填（例如第 2 期：計畫 2,500、輔導 1,900）。填了之後，輸入公糧時打核定面積（分），系統會先算出建議的計畫、輔導數量，再對照單子修改；空白就不建議。
      </p>
      <div className="mt-3">
        <SaveButton status={status} dirty={dirty} onClick={save} />
      </div>
    </div>
  );
}

function VendorForm({ vendorName }: { vendorName: string }) {
  const router = useRouter();
  const [value, setValue] = useState(vendorName);
  const { status, run } = useSave();
  return (
    <div className="border-t border-line-soft pt-5">
      <h3 className="font-bold">週報表上的繳交業者</h3>
      <p className="mt-1 text-sm text-muted">所有期別共用。</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-60">
          <input className={inputClass} value={value} aria-label="繳交業者" onChange={(e) => setValue(e.target.value)} />
        </div>
        <SaveButton
          status={status}
          dirty={value !== vendorName}
          onClick={() =>
            run(async () => {
              const r = await saveVendorName(value);
              if (!r.ok) return r.error;
              router.refresh();
              return null;
            })
          }
        />
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
      const r = await savePeriodMoisture(sorted);
      if (!r.ok) return r.error;
      // 統一成資料庫的寫法（0.70 → 0.7），儲存後才不會一直顯示「有修改」
      setForm(sorted.map((x) => ({ moisture: String(x.moisture), rate: String(x.rate) })));
      router.refresh();
      return null;
    });

  return (
    <div>
      <h3 className="font-bold">水分折算率</h3>
      <p className="mt-1 text-sm text-muted">
        濕稻穀數量 = 公斤 ÷ 折算率。水分低於最小那一列時折算率為 0（週報表濕穀數量留白）；水分介於兩列之間時用較小那一列。
      </p>
      <table className="tabular mt-3 w-full max-w-sm text-sm">
        <thead>
          <tr className="text-muted">
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
                  className="rounded px-2 py-1 text-ghost hover:bg-red-50 hover:text-red-700"
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
          className="rounded-lg border border-field px-3 py-2 text-sm"
        >
          ＋ 加一列
        </button>
        <SaveButton status={status} dirty={dirty} onClick={save} />
      </div>
    </div>
  );
}

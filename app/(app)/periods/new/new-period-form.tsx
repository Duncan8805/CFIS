"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPeriod, type getNewPeriodDefaults } from "@/app/actions/periods";

type Defaults = Awaited<ReturnType<typeof getNewPeriodDefaults>>;

const text = (n: number | null) => (n === null ? "" : String(n));

// 新增期別：計算參數從最新一期複製、可以直接改；收購點、農民名冊、農會帳號所有期別共用
export function NewPeriodForm({ defaults, shared }: { defaults: Defaults; shared: { sites: number; farmers: number; accounts: number } }) {
  const router = useRouter();
  const [rocYear, setRocYear] = useState(String(defaults.rocYear));
  const [term, setTerm] = useState<1 | 2>(defaults.term);
  const [form, setForm] = useState({
    interestPerFen: text(defaults.interestPerFen),
    freightPerKg: text(defaults.freightPerKg),
    planKgPerHa: text(defaults.planKgPerHa),
    guideKgPerHa: text(defaults.guideKgPerHa),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `${rocYear || "—"} 年第 ${term} 期`;

  const submit = async () => {
    const optional = (s: string) => (s.trim() === "" ? null : Number(s.replace(/,/g, "")));
    const input = {
      rocYear: Number(rocYear),
      term,
      interestPerFen: Number(form.interestPerFen),
      freightPerKg: Number(form.freightPerKg),
      planKgPerHa: optional(form.planKgPerHa),
      guideKgPerHa: optional(form.guideKgPerHa),
    };
    if (Object.values(input).some((v) => v !== null && !Number.isFinite(v))) return setError("請填數字");
    setBusy(true);
    setError(null);
    const r = await createPeriod(input);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push("/");
    router.refresh();
  };

  const field = (key: keyof typeof form, title: string, strong = false) => (
    <label className={`flex flex-col gap-1.5 text-[13px] ${strong ? "font-bold text-brand-700" : "text-muted"}`}>
      {title}
      <input
        value={form[key]}
        inputMode="decimal"
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={`tabular h-11 rounded-[4px] bg-white px-3 text-right text-[17px] font-normal text-ink focus:outline-none ${
          strong ? "border-2 border-brand-600" : "border border-field focus:border-brand-600"
        }`}
      />
    </label>
  );

  return (
    <section aria-labelledby="new-period-h" className="mx-auto flex w-full max-w-[720px] flex-col rounded-[4px] border border-line bg-white">
      <header className="flex items-start gap-3 border-b border-line-soft px-6 pb-3.5 pt-5">
        <div className="flex-1">
          <h1 id="new-period-h" className="text-[22px] font-bold">
            新增期別
          </h1>
          <p className="mt-1 text-sm text-muted">建好後會自動切換到新的一期，公糧、週報表、收款單從空白開始。</p>
        </div>
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center rounded-[4px] border border-field bg-white px-3 text-[15px] text-ink hover:border-brand-600">
          關閉
        </Link>
      </header>

      <div className="flex flex-col gap-5 px-6 py-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[14px] text-muted">
            年度（民國）
            <input
              value={rocYear}
              inputMode="numeric"
              onChange={(e) => setRocYear(e.target.value.replace(/\D/g, ""))}
              className="h-[46px] rounded-[4px] border border-field px-3 text-lg text-ink focus:border-brand-600 focus:outline-none"
            />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[14px] text-muted">期別</legend>
            <div className="flex gap-2">
              {([1, 2] as const).map((t) => (
                <label
                  key={t}
                  className={`flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[4px] ${
                    term === t ? "border-2 border-brand-600 bg-brand-50 font-bold text-brand-700" : "border border-field text-faint"
                  }`}
                >
                  <input type="radio" name="term" checked={term === t} onChange={() => setTerm(t)} className="size-[22px] accent-brand-600" />第 {t} 期
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <section aria-labelledby="calc-h" className="overflow-hidden rounded-[4px] border border-line">
          <div className="flex flex-wrap items-baseline gap-2.5 border-b border-line bg-head px-4 py-2.5">
            <h2 id="calc-h" className="flex-1 font-bold">
              這一期的計算參數
            </h2>
            <span className="text-[14px] text-muted">從 {defaults.from} 複製，可以直接改；改了不影響 {defaults.from}</span>
          </div>
          <div className="grid grid-cols-1 gap-3.5 p-4 sm:grid-cols-2">
            {field("interestPerFen", "每分利（利 = 分 × 這個數字）")}
            {field("freightPerKg", "每公斤運費（運費 = 公斤 × 這個數字）")}
            {field("planKgPerHa", "每公頃計畫收購（公斤）", true)}
            {field("guideKgPerHa", "每公頃輔導收購（公斤）", true)}
            <p className="text-[14px] text-muted sm:col-span-2">
              每公頃的數量照農會核定通知單填（第 2 期：計畫 2,500、輔導 1,900）。輸入公糧時打了核定面積，系統會先幫你算出建議的計畫、輔導數量，再對照單子修改。
            </p>
            <p className="rounded-[4px] bg-panel px-3 py-2.5 text-sm sm:col-span-2">
              水分折算率：沿用 {defaults.from} 的表（共 {defaults.moistureCount} 列），建好後可以在「設定 → 計算參數」修改。
            </p>
          </div>
        </section>

        <section aria-labelledby="shared-h" className="flex flex-col gap-2">
          <h2 id="shared-h" className="font-bold">
            直接沿用，不用重建
          </h2>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <li className="rounded-[4px] border border-line px-3.5 py-3">
              <div className="font-bold">收購點</div>
              <div className="text-[14px] text-muted">{shared.sites} 個，含週報表名稱、備註規則</div>
            </li>
            <li className="rounded-[4px] border border-line px-3.5 py-3">
              <div className="font-bold">農民名冊</div>
              <div className="text-[14px] text-muted">{shared.farmers} 位，打檔號就帶出姓名、電話、地址</div>
            </li>
            <li className="rounded-[4px] border border-line px-3.5 py-3">
              <div className="font-bold">農會帳號</div>
              <div className="text-[14px] text-muted">收款單上的 {shared.accounts} 個帳號</div>
            </li>
          </ul>
        </section>
        {error && <p role="alert" className="rounded-[4px] border border-red-700 bg-red-50 px-3 py-2 text-[15px] text-red-800">{error}</p>}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-line-soft px-6 pb-5 pt-4">
        <span className="min-w-56 flex-1 text-[14px] text-muted">{defaults.from}的資料完全保留，隨時可以從「目前期別」切回去</span>
        <Link href="/" className="flex h-[46px] items-center rounded-[4px] border border-field bg-white px-[18px] text-[15px] text-ink hover:border-brand-600">
          取消
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="h-[46px] rounded-[4px] bg-brand-600 px-[22px] text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "建立中…" : `建立 ${label}`}
        </button>
      </footer>
    </section>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getCurrentPeriod, listPeriods, periodLabel, periodShort } from "@/lib/data/period";
import { listSites } from "@/lib/data/sites";
import { periodSummary, type PeriodSummary } from "@/lib/data/summary";
import { getCalcSettings } from "@/lib/data/settings";
import { prepaidRows } from "@/lib/data/prepaid";
import { PrepaidSimulator } from "./prepaid-sim";
import { PrintButton, SiteTable, TrendChart, type SiteRow, type TrendPoint } from "./reports-client";

export const metadata: Metadata = { title: "報表" };

const fmt = (n: number, digits = 0) => n.toLocaleString("zh-TW", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const perKg = (deposit: number, kg: number) => (kg ? deposit / kg : 0);

/** 週報表的進倉日期 → 那一週的星期一（M/D） */
function weekOf(date: string): { key: string; label: string } {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return { key: d.toISOString().slice(0, 10), label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}` };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default async function ReportsPage() {
  const [period, periods, sites] = await Promise.all([getCurrentPeriod(), listPeriods(), listSites({ includeInactive: true })]);
  // 趨勢只看到正在看的這一期為止（看舊期別時不會出現之後的期別）
  const upTo = periods.filter((p) => p.rocYear < period.rocYear || (p.rocYear === period.rocYear && p.term <= period.term)).reverse();
  const summaries = new Map<number, PeriodSummary>(
    await Promise.all(upTo.map(async (p) => [p.id, await periodSummary(p, sites)] as const)),
  );
  const summary = summaries.get(period.id)!;
  const calc = await getCalcSettings(period);
  const simRows = await prepaidRows(period, sites, calc);
  const perHa = (calc.planKgPerHa ?? 0) + (calc.guideKgPerHa ?? 0);
  const planNote = perHa ? `每公頃 ${fmt(perHa)} 公斤` : null;
  const t = summary.totals;
  const avgPerKg = perKg(t.deposit, t.depositKg);

  const trend: TrendPoint[] = upTo.map((p) => {
    const s = summaries.get(p.id)!.totals;
    return { label: periodShort(p), kg: s.kg, deposit: s.deposit, collect: s.collect, freight: s.freight, perKg: perKg(s.deposit, s.depositKg) };
  });

  // 每週進倉公斤（依週報表濕穀進儲日期）
  const weeks = new Map<string, { label: string; kg: number }>();
  for (const w of summary.weekly) {
    if (!w.intakeDate || !w.kg) continue;
    const { key, label } = weekOf(w.intakeDate);
    weeks.set(key, { label, kg: (weeks.get(key)?.kg ?? 0) + w.kg });
  }
  const weekList = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const weekMax = Math.max(1, ...weekList.map((w) => w.kg));
  const weekTotal = weekList.reduce((n, w) => n + w.kg, 0);
  const topWeeks = [...weekList].sort((a, b) => b.kg - a.kg).slice(0, 2);

  // 水分分布
  const moist = new Map<number, number>();
  for (const w of summary.weekly) if (w.moisture !== null) moist.set(w.moisture, (moist.get(w.moisture) ?? 0) + 1);
  const moistList = [...moist.entries()].sort(([a], [b]) => a - b);
  const moistMax = Math.max(1, ...moistList.map(([, n]) => n));
  const moistCount = moistList.reduce((n, [, c]) => n + c, 0);

  // 農民集中度
  const fk = [...summary.farmerKg].sort((a, b) => b - a);
  const top = fk.slice(0, Math.max(1, Math.ceil(fk.length * 0.1)));
  const topShare = fk.length ? top.reduce((n, v) => n + v, 0) / fk.reduce((n, v) => n + v, 0) : 0;
  const recordKg = summary.weekly.map((w) => w.kg).filter((v): v is number => v !== null && v > 0);

  const siteRows: SiteRow[] = summary.sites
    .filter((s) => s.count > 0)
    .map((s) => {
      const per = s.depositMissing === s.count ? null : perKg(s.deposit, s.depositKg);
      return {
        id: s.site.id,
        name: s.site.name,
        kg: s.kg,
        share: t.kg ? s.kg / t.kg : 0,
        deposit: s.depositMissing === s.count ? null : s.deposit,
        collect: s.depositMissing === s.count ? null : s.collect,
        freight: s.freight,
        perKg: per,
        low: per !== null && avgPerKg > 0 && per < avgPerKg * 0.95,
        collectText: s.collectText,
        depositMissing: s.depositMissing,
      };
    });
  const lowSites = siteRows.filter((s) => s.low);
  const unpaid = siteRows.filter((s) => s.deposit === null);

  const kpis = [
    { label: "入簿總額", value: `NT$ ${fmt(t.deposit)}`, sub: t.depositMissing ? `${t.depositMissing} 筆入簿未填，不列入` : "公糧表「入簿」欄合計" },
    { label: "收（應收）", value: `NT$ ${fmt(t.collect)}`, sub: t.collectText ? `另有 ${t.collectText} 筆寫「扣」` : "入簿 − 先付", brand: true },
    { label: "先付", value: `NT$ ${fmt(t.prepaid)}`, sub: `利 ${fmt(t.interest)} − 運費 ${fmt(t.freight)}` },
    { label: "運費", value: `NT$ ${fmt(t.freight)}`, sub: `平均每公斤 ${t.kg ? fmt(t.freight / t.kg, 2) : "—"}` },
    { label: "總公斤", value: fmt(t.kg), sub: `${fmt(t.count)} 筆・分合計 ${fmt(t.fen, 2)}` },
    { label: "平均入簿／公斤", value: `NT$ ${fmt(avgPerKg, 2)}`, sub: "入簿總額 ÷ 有入簿的公斤" },
  ];

  const card = "rounded-[4px] border border-line bg-white p-4";

  return (
    <div className="flex max-w-[1280px] flex-col gap-4">
      <PageHeader
        title="報表"
        context={`${periodLabel(period)}・${summary.sites.filter((s) => s.count > 0).length} 個收購點・${fmt(t.count)} 筆`}
        actions={<PrintButton />}
      />

      <section aria-label="本期金額" className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line-soft lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex min-w-0 flex-col gap-0.5 bg-white px-4 py-3">
            <span className="text-[14px] text-muted">{k.label}</span>
            <span className={`tabular truncate text-xl font-semibold md:text-[24px] ${k.brand ? "text-brand-700" : "text-ink"}`}>{k.value}</span>
            <span className="truncate text-[14px] text-muted">{k.sub}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="trend-h" className={card}>
        <TrendChart points={trend} />
        {trend.length < 2 && (
          <p className="mt-3 text-[13px] text-muted">
            目前只有 {periodLabel(period)} 的資料。新增或匯入其他期別後，這裡就能看出每一期的增減。
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="week-h" className={card}>
          <h2 id="week-h" className="text-[16px] font-bold">
            每週進倉公斤
          </h2>
          <p className="text-[13px] text-muted">依週報表的濕穀進儲日期，看收穀集中在哪幾週（每週從星期一算）</p>
          {weekList.length ? (
            <>
              <Bars items={weekList.map((w) => ({ label: w.label, value: w.kg, text: w.kg >= 10000 ? `${Math.round(w.kg / 10000)}萬` : fmt(w.kg) }))} max={weekMax} highlight={(v) => v >= weekMax * 0.9} />
              {topWeeks.length === 2 && weekTotal > 0 && (
                <p className="mt-3 text-sm text-ink-2">
                  {topWeeks[0].label} 和 {topWeeks[1].label} 這兩週進倉最多，合計佔全期的{" "}
                  {Math.round(((topWeeks[0].kg + topWeeks[1].kg) / weekTotal) * 100)}%。
                </p>
              )}
            </>
          ) : (
            <p className="mt-6 text-[15px] text-muted">週報表還沒有填進倉日期</p>
          )}
        </section>
        <section aria-labelledby="moist-h" className={card}>
          <h2 id="moist-h" className="text-[16px] font-bold">
            水分分布
          </h2>
          <p className="text-[13px] text-muted">週報表 {fmt(moistCount)} 筆的水分</p>
          {moistList.length ? (
            <Bars items={moistList.map(([m, n]) => ({ label: `${m}%`, value: n, text: fmt(n) }))} max={moistMax} />
          ) : (
            <p className="mt-6 text-[15px] text-muted">週報表還沒有填水分</p>
          )}
        </section>
      </div>

      <section aria-labelledby="site-h" className={`${card} !p-0 overflow-hidden`}>
        <div className="flex flex-wrap items-baseline gap-3 border-b border-line bg-head px-4 py-2.5">
          <h2 id="site-h" className="text-[16px] font-bold">
            各收購點
          </h2>
          <span className="text-[14px] text-muted">點欄位名稱排序・入簿／公斤明顯低於平均的用橘色標出</span>
        </div>
        <SiteTable rows={siteRows} totals={{ kg: t.kg, deposit: t.deposit, collect: t.collect, freight: t.freight, perKg: avgPerKg }} />
        {(lowSites.length > 0 || unpaid.length > 0) && (
          <div className="flex flex-col gap-1 border-t border-warn-line bg-warn-50 px-4 py-3 text-[15px]">
            <b>值得看一下</b>
            {lowSites.length > 0 && (
              <span>
                {lowSites.map((s) => `${s.name}每公斤入簿 ${fmt(s.perKg ?? 0, 2)}`).join("、")}，低於全期平均 {fmt(avgPerKg, 2)}。
                {lowSites.some((s) => s.collectText) &&
                  `其中 ${lowSites
                    .filter((s) => s.collectText)
                    .map((s) => `${s.name}有 ${s.collectText} 筆的收是「扣」`)
                    .join("、")}，可能是原因之一。`}
              </span>
            )}
            {unpaid.length > 0 && <span>{unpaid.map((s) => s.name).join("、")}的入簿都還沒填，所以不列入金額。</span>}
          </div>
        )}
      </section>

      <section aria-labelledby="prepaid-h" className={card}>
        <PrepaidSimulator
          rows={simRows}
          sites={summary.sites.map((x) => ({ id: x.site.id, name: x.site.name }))}
          rates={calc.rates}
          planNote={planNote}
        />
      </section>

      <section aria-labelledby="farmer-h" className={card}>
        <h2 id="farmer-h" className="mb-3 text-[16px] font-bold">
          農民
        </h2>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[4px] border border-line bg-line-soft sm:grid-cols-3">
          <div className="bg-white px-4 py-3">
            <div className="text-[13px] text-muted">本期農民人數</div>
            <div className="tabular text-2xl font-bold">{fmt(fk.length)}</div>
            <div className="text-[13px] text-muted">依農民名冊；補上檔號後更準</div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="text-[13px] text-muted">每筆公斤中位數</div>
            <div className="tabular text-2xl font-bold">{fmt(median(recordKg))}</div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="text-[13px] text-muted">前 10% 農民佔</div>
            <div className="tabular text-2xl font-bold">{fmt(topShare * 100, 1)}%</div>
            <div className="text-[13px] text-muted">的公斤</div>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-muted">要看某一位農民歷期的繳穀紀錄，到「農民」用檔號或姓名找。</p>
      </section>
    </div>
  );
}

function Bars({
  items,
  max,
  highlight,
}: {
  items: { label: string; value: number; text: string }[];
  max: number;
  highlight?: (v: number) => boolean;
}) {
  return (
    <div className="mt-4 overflow-x-auto overflow-y-hidden">
      <div className="flex min-w-max items-end gap-2" style={{ height: 196 }}>
        {items.map((it) => (
          <div key={it.label} className="flex w-12 flex-col items-center justify-end gap-1 self-stretch">
            <span className="tabular text-[13px] text-ink-2">{it.text}</span>
            <div
              className={`w-9 rounded-t-[2px] ${highlight?.(it.value) ? "bg-brand-600" : "bg-brand-200"}`}
              style={{ height: `${Math.max(2, Math.round((it.value / max) * 160))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex min-w-max gap-2 border-t border-line pt-1.5">
        {items.map((it) => (
          <span key={it.label} className="w-12 text-center text-[13px] text-muted">
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

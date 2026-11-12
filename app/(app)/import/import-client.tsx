"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { importSite, type ImportContext } from "@/app/actions/import";
import { parseGrainWorkbook, parseWeeklyWorkbook } from "@/lib/import/excel";
import { buildImportPlan, type ImportPlan, type IssueKind, type SitePlan } from "@/lib/import/plan";

const ISSUE_LABEL: Record<IssueKind, string> = {
  calc_mismatch: "計算跟 Excel 不同",
  name_mismatch: "姓名寫法不同",
  kg_mismatch: "公斤不同",
  weekly_missing: "週報表找不到",
  weekly_extra: "週報表多出來",
  phone_leading_zero: "電話少了 0",
  suspicious_name: "姓名可疑",
};

async function readWorkbook(file: File) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return wb;
}

type Status = { state: "idle" } | { state: "running"; done: number; total: number } | { state: "done"; message: string };

export function ImportClient({ context }: { context: ImportContext }) {
  const router = useRouter();
  const [grainFile, setGrainFile] = useState<File | null>(null);
  const [weeklyFile, setWeeklyFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [results, setResults] = useState<Record<number, string>>({});

  async function analyze() {
    if (!grainFile) return;
    setParsing(true);
    setError(null);
    setResults({});
    try {
      const grain = parseGrainWorkbook(await readWorkbook(grainFile));
      const weekly = weeklyFile ? parseWeeklyWorkbook(await readWorkbook(weeklyFile)) : { rows: [] };
      const next = buildImportPlan(grain.rows, weekly.rows, context.sites, context.rates);
      if (!next.sites.length) throw new Error("這個檔案裡沒有任何收購點的工作表");
      setPlan(next);
      setSelected(new Set(next.sites.map((s) => s.siteId)));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "無法讀取檔案，請確認是 .xlsx 或 .xlsm");
      setPlan(null);
    } finally {
      setParsing(false);
    }
  }

  const chosen = useMemo(() => plan?.sites.filter((s) => selected.has(s.siteId)) ?? [], [plan, selected]);
  const overwriting = chosen.filter((s) => context.existing[s.siteId]);

  async function runImport() {
    if (!chosen.length) return;
    const total = chosen.reduce((n, s) => n + s.records.length, 0);
    const warn = overwriting.length
      ? `\n\n注意：${overwriting.map((s) => s.siteName).join("、")} 已經有資料，匯入會整批取代。`
      : "";
    if (!confirm(`要匯入 ${chosen.length} 個收購點、共 ${total} 筆嗎？${warn}`)) return;

    const out: Record<number, string> = {};
    for (let i = 0; i < chosen.length; i++) {
      const s = chosen[i];
      setStatus({ state: "running", done: i, total: chosen.length });
      const r = await importSite({ siteId: s.siteId, agentContact: s.agentContact, records: s.records });
      out[s.siteId] = r.ok ? `✓ 已匯入 ${r.imported} 筆（週報表 ${r.weekly} 筆）` : `✗ ${r.error}`;
      setResults({ ...out });
    }
    const failed = Object.values(out).filter((m) => m.startsWith("✗")).length;
    setStatus({ state: "done", message: failed ? `完成，但有 ${failed} 個收購點失敗` : "全部匯入完成" });
    router.refresh();
  }

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 rounded-[4px] border border-line bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <FilePicker label="公糧 Excel（必選）" file={grainFile} onChange={setGrainFile} />
        <FilePicker label="週報表 Excel（建議一起選）" file={weeklyFile} onChange={setWeeklyFile} />
        <button
          type="button"
          onClick={analyze}
          disabled={!grainFile || parsing}
          className="min-h-11 rounded-[4px] bg-brand-600 px-5 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {parsing ? "讀取中…" : "讀取並比對"}
        </button>
      </section>

      {error && <p role="alert" className="rounded-[4px] border border-red-700 bg-red-50 px-4 py-3 text-[15px] text-red-800">{error}</p>}

      {plan && (
        <>
          <Notes plan={plan} />
          <section className="overflow-hidden rounded-[4px] border border-line bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-head px-4 py-2.5">
              <h2 className="text-[16px] font-bold">比對結果</h2>
              <span className="text-[14px] text-muted">展開可以看每一筆差異；確認後勾選要匯入的收購點</span>
            </div>
            <ul className="divide-y divide-line-soft">
              {plan.sites.map((s) => (
                <SiteRow
                  key={s.siteId}
                  site={s}
                  existing={context.existing[s.siteId] ?? 0}
                  checked={selected.has(s.siteId)}
                  onToggle={() => toggle(s.siteId)}
                  result={results[s.siteId]}
                />
              ))}
            </ul>
          </section>

          <div className="sticky bottom-20 flex flex-wrap items-center gap-3 rounded-[4px] border-2 border-line bg-white px-4 py-3 md:bottom-4">
            <span className="text-[15px]">
              已選 {chosen.length} 個收購點、{chosen.reduce((n, s) => n + s.records.length, 0)} 筆
              {overwriting.length > 0 && <span className="font-bold text-warn-700">（{overwriting.length} 個會取代現有資料）</span>}
            </span>
            <span className="text-[15px] text-muted">
              {status.state === "running" && `寫入中… ${status.done}/${status.total}`}
              {status.state === "done" && status.message}
            </span>
            <button
              type="button"
              onClick={runImport}
              disabled={!chosen.length || status.state === "running"}
              className="ml-auto min-h-11 rounded-[4px] bg-brand-600 px-6 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              匯入
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FilePicker({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[15px]">
      <span className="text-ink-2">{label}</span>
      <input
        type="file"
        accept=".xlsx,.xlsm"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="min-h-11 rounded-[4px] border border-field bg-white px-2 py-1.5 text-[15px] file:mr-3 file:min-h-8 file:rounded-[4px] file:border file:border-field file:bg-head file:px-3 file:text-[15px] file:text-ink"
      />
      {file && <span className="truncate text-[14px] text-muted">{file.name}</span>}
    </label>
  );
}

function Notes({ plan }: { plan: ImportPlan }) {
  const notes = [
    plan.unknownSheets.length && `公糧 Excel 這些工作表沒有對應的收購點，不會匯入：${plan.unknownSheets.join("、")}`,
    plan.missingWeeklySheets.length && `週報表沒有這些收購點的工作表，週報表資料要之後再補：${plan.missingWeeklySheets.join("、")}`,
    plan.unusedWeeklySheets.length && `週報表這些工作表沒有配對到任何公糧資料：${plan.unusedWeeklySheets.join("、")}`,
  ].filter(Boolean) as string[];
  if (!notes.length) return null;
  return (
    <ul className="list-disc space-y-1 rounded-[4px] border border-warn-line bg-warn-50 py-3 pl-8 pr-4 text-[15px] text-warn-800">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

function SiteRow({
  site,
  existing,
  checked,
  onToggle,
  result,
}: {
  site: SitePlan;
  existing: number;
  checked: boolean;
  onToggle: () => void;
  result?: string;
}) {
  const byKind = new Map<IssueKind, number>();
  for (const i of site.issues) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
  const kg = site.records.reduce((n, r) => n + (r.kg ?? 0), 0);
  const ownRounding = site.records.filter((r) => r.roundingMode);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex min-h-11 min-w-32 cursor-pointer items-center gap-2.5 font-bold">
          <input type="checkbox" checked={checked} onChange={onToggle} className="size-[22px] shrink-0 accent-brand-600" />
          {site.siteName}
        </label>
        <span className="text-[15px] text-ink-2"><span className="tabular">{site.records.length}</span> 筆</span>
        <span className="text-[15px] text-ink-2"><span className="tabular">{kg.toLocaleString("zh-TW")}</span> 公斤</span>
        <span className="text-[15px] text-ink-2">
          週報表 <span className="tabular">{site.weeklyMatched}/{site.records.length}</span>
        </span>
        {ownRounding.length > 0 && (
          <span className="text-[15px] text-muted">
            {ownRounding.length} 筆照 Excel 改用{ownRounding[0].roundingMode === "truncate" ? "無條件捨去" : "不捨去"}
          </span>
        )}
        {existing > 0 && <span className="text-[15px] font-bold text-warn-700">系統已有 {existing} 筆</span>}
        {result && <span className={`text-[15px] font-bold ${result.startsWith("✓") ? "text-brand-700" : "text-red-700"}`}>{result}</span>}
      </div>
      {site.issues.length > 0 && (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-[15px] text-ink-2">
            {[...byKind].map(([k, n]) => `${ISSUE_LABEL[k]} ${n}`).join("・")}
          </summary>
          <ul className="mt-2 space-y-1 text-[15px]">
            {site.issues.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="shrink-0 rounded-[4px] border border-line bg-head px-1.5 text-[13px] leading-5 text-ink-2">{ISSUE_LABEL[i.kind]}</span>
                <span className="text-muted">
                  {i.sheet} 第 {i.row} 列
                </span>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

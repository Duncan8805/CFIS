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
      <section className="grid gap-3 rounded-xl border border-black/10 bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-end md:p-5">
        <FilePicker label="公糧 Excel（必選）" file={grainFile} onChange={setGrainFile} />
        <FilePicker label="週報表 Excel（建議一起選）" file={weeklyFile} onChange={setWeeklyFile} />
        <button
          type="button"
          onClick={analyze}
          disabled={!grainFile || parsing}
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {parsing ? "讀取中…" : "讀取並比對"}
        </button>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {plan && (
        <>
          <Notes plan={plan} />
          <section className="overflow-hidden rounded-xl border border-black/10 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3">
              <h2 className="font-bold">比對結果</h2>
              <span className="text-sm text-black/55">展開可以看每一筆差異；確認後勾選要匯入的收購點</span>
            </div>
            <ul className="divide-y divide-black/5">
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

          <div className="sticky bottom-20 flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white/95 p-4 shadow-sm backdrop-blur md:bottom-4">
            <span className="text-sm">
              已選 {chosen.length} 個收購點、{chosen.reduce((n, s) => n + s.records.length, 0)} 筆
              {overwriting.length > 0 && <span className="text-amber-700">（{overwriting.length} 個會取代現有資料）</span>}
            </span>
            <span className="text-sm text-black/55">
              {status.state === "running" && `寫入中… ${status.done}/${status.total}`}
              {status.state === "done" && status.message}
            </span>
            <button
              type="button"
              onClick={runImport}
              disabled={!chosen.length || status.state === "running"}
              className="ml-auto rounded-lg bg-brand-600 px-5 py-2.5 font-bold text-white hover:bg-brand-700 disabled:opacity-40"
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-black/60">{label}</span>
      <input
        type="file"
        accept=".xlsx,.xlsm"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="rounded-lg border border-black/20 px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700"
      />
      {file && <span className="truncate text-xs text-black/45">{file.name}</span>}
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
    <ul className="list-disc space-y-1 rounded-xl border border-amber-200 bg-amber-50 py-3 pl-8 pr-4 text-sm text-amber-900">
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
        <label className="flex min-w-32 items-center gap-2 font-bold">
          <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 accent-brand-600" />
          {site.siteName}
        </label>
        <span className="tabular text-sm text-black/70">{site.records.length} 筆</span>
        <span className="tabular text-sm text-black/70">{kg.toLocaleString("zh-TW")} 公斤</span>
        <span className="tabular text-sm text-black/70">
          週報表 {site.weeklyMatched}/{site.records.length}
        </span>
        {ownRounding.length > 0 && (
          <span className="text-sm text-black/60">
            {ownRounding.length} 筆照 Excel 改用{ownRounding[0].roundingMode === "truncate" ? "無條件捨去" : "不捨去"}
          </span>
        )}
        {existing > 0 && <span className="text-sm text-amber-700">系統已有 {existing} 筆</span>}
        {result && <span className={`text-sm ${result.startsWith("✓") ? "text-brand-700" : "text-red-700"}`}>{result}</span>}
      </div>
      {site.issues.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-black/60">
            {[...byKind].map(([k, n]) => `${ISSUE_LABEL[k]} ${n}`).join("・")}
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {site.issues.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="shrink-0 rounded bg-black/5 px-1.5 text-xs leading-5 text-black/60">{ISSUE_LABEL[i.kind]}</span>
                <span className="text-black/45">
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

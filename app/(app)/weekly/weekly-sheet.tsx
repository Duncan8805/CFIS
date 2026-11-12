"use client";

import { useCallback, useMemo, useState } from "react";
import { setMoistures, updateWeeklyEntry } from "@/app/actions/weekly";
import { calcWeekly, randomMoistures, weeklyRemark, type MoistureRate, type RemarkMode } from "@/lib/calc";
import {
  parseWeeklyField,
  type WeeklyDefaults,
  type WeeklyField,
  type WeeklyPatch,
  type WeeklyRowDto,
} from "@/lib/weekly/fields";
import { Toast, useToast } from "@/components/toast";
import { useRecordSaver } from "@/components/use-record-saver";
import { WeeklyCards } from "./weekly-cards";
import { WeeklyGrid } from "./weekly-grid";
import { WeeklyPrint } from "./weekly-print";

export interface WeeklySite {
  id: number;
  name: string;
  weeklySheetName: string;
  sellTo: string;
  remarkMode: RemarkMode;
  agentContact: string | null;
}

export interface WRow {
  row: WeeklyRowDto;
  defaults: WeeklyDefaults;
  rate: number;
  wetQuantity: number | null;
  saving: boolean;
}

export type WeeklySaveFn = (entryId: number, entries: [WeeklyField, string][]) => Promise<string | null>;

export const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString("zh-TW", { maximumFractionDigits: 2 }));

const entryId = (r: WeeklyRowDto) => r.entryId;

export function WeeklySheet({
  site,
  period,
  vendor,
  moistureRates,
  initialRows,
}: {
  site: WeeklySite;
  period: { rocYear: number; term: number };
  vendor: string;
  /** 水分折算率表（設定頁可改） */
  moistureRates: MoistureRate[];
  initialRows: WeeklyRowDto[];
}) {
  const { message: error, show: showError } = useToast();
  const { rows, setRows, rowsRef, saving, apply } = useRecordSaver<WeeklyRowDto, WeeklyPatch>({
    initial: initialRows,
    idOf: entryId,
    send: updateWeeklyEntry,
    onError: showError,
  });
  // 列印模式：跟 Excel 巨集一樣隱藏「公斤」與「濕稻穀折算」
  const [printMode, setPrintMode] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const year = period.rocYear + 1911;

  const defaultsFor = useCallback(
    (r: WeeklyRowDto): WeeklyDefaults => ({
      year,
      sellTo: site.sellTo,
      remark: weeklyRemark({ mode: site.remarkMode, farmerPhone: r.phone, agentContact: site.agentContact }),
    }),
    [year, site.sellTo, site.remarkMode, site.agentContact],
  );

  const wrows: WRow[] = useMemo(
    () =>
      rows.map((row) => {
        const { rate, wetQuantity } = calcWeekly({ kg: row.kg, moisture: row.moisture }, moistureRates);
        return { row, defaults: defaultsFor(row), rate, wetQuantity, saving: saving.has(row.entryId) };
      }),
    [rows, saving, defaultsFor, moistureRates],
  );

  const save: WeeklySaveFn = useCallback(
    async (id, entries) => {
      const current = rowsRef.current.find((r) => r.entryId === id);
      if (!current) return "找不到這筆資料";
      const defaults = defaultsFor(current);
      let patch: WeeklyPatch = {};
      for (const [field, raw] of entries) {
        const parsed = parseWeeklyField(field, raw, defaults);
        if (!parsed.ok) {
          showError(parsed.error);
          return parsed.error;
        }
        patch = { ...patch, ...parsed.patch };
      }
      return apply(id, patch);
    },
    [apply, defaultsFor, rowsRef, showError],
  );

  const emptyMoisture = rows.filter((r) => r.moisture === null);

  async function fillRandom(target: WeeklyRowDto[]) {
    setRandomOpen(false);
    if (!target.length) return;
    const values = randomMoistures(target.length);
    const items = target.map((r, i) => ({ entryId: r.entryId, moisture: values[i] }));
    const before = rowsRef.current;
    const byId = new Map(items.map((i) => [i.entryId, i.moisture]));
    setRows((rs) => rs.map((r) => (byId.has(r.entryId) ? { ...r, moisture: byId.get(r.entryId)! } : r)));
    const result = await setMoistures(items);
    if (!result.ok) {
      setRows(before);
      showError(result.error);
    }
  }

  const totalKg = rows.reduce((n, r) => n + (r.kg ?? 0), 0);
  const totalWet = wrows.reduce((n, r) => n + (r.wetQuantity ?? 0), 0);

  return (
    <>
      <div className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span className="tabular">{rows.length} 筆</span>
          <span className="tabular">{fmt(totalKg)} 公斤</span>
          <span className="tabular">濕穀 {fmt(totalWet)}</span>
          {emptyMoisture.length > 0 && <span className="text-warn-700">{emptyMoisture.length} 筆還沒有水分</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setRandomOpen((v) => !v)}
                disabled={!rows.length}
                className="rounded-lg border border-field bg-white px-3 py-2 text-black hover:border-brand-500 disabled:opacity-40"
              >
                隨機產生水分
              </button>
              {randomOpen && (
                <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-white p-2 text-black shadow-lg">
                  <button
                    type="button"
                    onClick={() => fillRandom(emptyMoisture)}
                    disabled={!emptyMoisture.length}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-brand-50 disabled:opacity-40"
                  >
                    只填還沒有水分的（{emptyMoisture.length} 筆）
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`全部 ${rows.length} 筆的水分都會重新產生，原本的水分會被取代。確定嗎？`)) fillRandom(rows);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-brand-50"
                  >
                    全部重新產生（{rows.length} 筆）
                  </button>
                  <p className="px-3 pb-1 pt-2 text-xs text-muted">
                    24–30，以 26、27 最多；2 筆以上保證至少一個 30（跟原本的巨集一樣）
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPrintMode((v) => !v)}
              aria-pressed={printMode}
              className={`hidden rounded-lg border px-3 py-2 md:block ${
                printMode ? "border-brand-600 bg-brand-50 font-bold text-brand-700" : "border-field bg-white text-black"
              }`}
            >
              {printMode ? "目前：列印模式" : "目前：編輯模式"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!rows.length}
              className="rounded-lg bg-brand-600 px-4 py-2 font-bold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              列印
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-field bg-white p-6 text-center text-sm text-muted">
            這個收購點還沒有資料。到「公糧」新增，或從「設定 → 匯入 Excel」匯入，週報表就會出現。
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <WeeklyGrid rows={wrows} save={save} printMode={printMode} />
            </div>
            <div className="md:hidden">
              <WeeklyCards rows={wrows} save={save} />
            </div>
          </>
        )}
      </div>

      <WeeklyPrint rows={wrows} period={period} vendor={vendor} />
      <Toast message={error} />
    </>
  );
}

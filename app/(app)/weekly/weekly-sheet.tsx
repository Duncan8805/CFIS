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
import { FailedCellsContext, useFailedCellCount } from "@/components/failed-cells";
import { buttonClass } from "@/components/page-header";
import { SaveStatus } from "@/components/save-status";
import { Toast, useToast } from "@/components/toast";
import { useRecordSaver } from "@/components/use-record-saver";
import { useUnsavedGuard } from "@/components/use-unsaved-guard";
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
  const { message: error, show: showError, dismiss: dismissError } = useToast();
  const { rows, setRows, rowsRef, saving, apply } = useRecordSaver<WeeklyRowDto, WeeklyPatch>({
    initial: initialRows,
    idOf: entryId,
    send: updateWeeklyEntry,
    onError: showError,
  });
  // 還在存的時候關分頁，先提醒（沒存到的格子由格子自己提醒）
  const [fillingRandom, setFillingRandom] = useState(false);
  useUnsavedGuard(saving.size > 0 || fillingRandom);
  // 表格上方「有 N 格沒存到」用（只是計數，存檔照舊由格子處理）
  const failedCells = useFailedCellCount();
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
    setFillingRandom(true);
    try {
      const result = await setMoistures(items).catch(() => ({ ok: false as const, error: "水分沒存到：網路可能斷了，請再按一次隨機產生" }));
      if (!result.ok) {
        setRows(before);
        showError(result.error);
      }
    } finally {
      setFillingRandom(false);
    }
  }

  const totalKg = rows.reduce((n, r) => n + (r.kg ?? 0), 0);
  const totalWet = wrows.reduce((n, r) => n + (r.wetQuantity ?? 0), 0);

  return (
    <>
      <div className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-ink-2">
          <span><span className="tabular">{rows.length}</span> 筆</span>
          <span><span className="tabular">{fmt(totalKg)}</span> 公斤</span>
          <span>濕穀 <span className="tabular">{fmt(totalWet)}</span></span>
          {emptyMoisture.length > 0 && <span className="font-bold text-warn-700">{emptyMoisture.length} 筆還沒有水分</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setRandomOpen((v) => !v)}
                disabled={!rows.length}
                className={buttonClass.secondary}
              >
                隨機產生水分
              </button>
              {randomOpen && (
                <div className="absolute right-0 z-20 mt-1 w-72 rounded-[4px] border border-field bg-white p-1 text-ink shadow-[0_4px_12px_rgba(30,38,51,0.18)]">
                  <button
                    type="button"
                    onClick={() => fillRandom(emptyMoisture)}
                    disabled={!emptyMoisture.length}
                    className="block min-h-11 w-full rounded-[4px] px-3 text-left text-[15px] hover:bg-brand-50 disabled:opacity-40"
                  >
                    只填還沒有水分的（{emptyMoisture.length} 筆）
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`全部 ${rows.length} 筆的水分都會重新產生，原本的水分會被取代。確定嗎？`)) fillRandom(rows);
                    }}
                    className="block min-h-11 w-full rounded-[4px] px-3 text-left text-[15px] hover:bg-brand-50"
                  >
                    全部重新產生（{rows.length} 筆）
                  </button>
                  <p className="border-t border-line-soft px-3 pb-1 pt-2 text-[14px] text-muted">
                    24–30，以 26、27 最多；2 筆以上保證至少一個 30（跟原本的巨集一樣）
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPrintMode((v) => !v)}
              aria-pressed={printMode}
              className={`hidden min-h-11 rounded-[4px] border px-4 text-[15px] md:block ${
                printMode ? "border-brand-600 bg-brand-50 font-bold text-brand-700" : "border-field bg-white text-ink"
              }`}
            >
              {printMode ? "目前：列印模式" : "目前：編輯模式"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!rows.length}
              className={buttonClass.primary}
            >
              列印
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-[4px] border border-dashed border-field bg-white p-6 text-center text-[15px] text-muted">
            這個收購點還沒有資料。到「公糧」新增，或從「設定 → 匯入 Excel」匯入，週報表就會出現。
          </p>
        ) : (
          <FailedCellsContext.Provider value={failedCells.report}>
            <SaveStatus
              saving={saving.size > 0 || fillingRandom}
              failed={failedCells.count}
              hint="方向鍵移動・Enter 往下・離開格子自動儲存"
            />
            <div className="hidden md:block">
              <WeeklyGrid rows={wrows} save={save} printMode={printMode} />
            </div>
            <div className="md:hidden">
              <WeeklyCards rows={wrows} save={save} />
            </div>
          </FailedCellsContext.Provider>
        )}
      </div>

      <WeeklyPrint rows={wrows} period={period} vendor={vendor} />
      <Toast message={error} onClose={dismissError} />
    </>
  );
}

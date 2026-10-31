"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createGrainRecord, deleteGrainRecord, updateGrainRecord } from "@/app/actions/grain";
import { calcGrain, effectiveRoundingMode, type GrainRates, type RoundingMode } from "@/lib/calc";
import type { FarmerSuggestion } from "@/lib/data/grain";
import { parseField, type EditableField, type GrainPatch, type GrainRecordDto } from "@/lib/grain/fields";
import { Toast, useToast } from "@/components/toast";
import { useRecordSaver } from "@/components/use-record-saver";
import { GrainCards } from "./grain-cards";
import { GrainGrid } from "./grain-grid";

export interface SheetSite {
  id: number;
  name: string;
  roundingMode: RoundingMode;
}

export interface Row {
  record: GrainRecordDto;
  calc: ReturnType<typeof calcGrain>;
  saving: boolean;
}

/** 儲存一筆的一或多個欄位；回傳錯誤訊息（成功時為 null） */
export type SaveFn = (id: number, entries: [EditableField, string][]) => Promise<string | null>;

const recordId = (r: GrainRecordDto) => r.id;

export const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString("zh-TW", { maximumFractionDigits: 2 }));

export function GrainSheet({
  site,
  rates,
  initialRecords,
  suggestions,
}: {
  site: SheetSite;
  /** 每分利、每公斤運費（設定頁可改） */
  rates: GrainRates;
  initialRecords: GrainRecordDto[];
  suggestions: FarmerSuggestion[];
}) {
  const router = useRouter();
  const { message: error, show: showError } = useToast();
  const [focusId, setFocusId] = useState<number | null>(null);
  const {
    rows: records,
    setRows: setRecords,
    rowsRef: recordsRef,
    saving,
    apply,
  } = useRecordSaver<GrainRecordDto, GrainPatch>({
    initial: initialRecords,
    idOf: recordId,
    send: updateGrainRecord,
    onError: showError,
  });

  const suggestionByName = useMemo(() => new Map(suggestions.map((s) => [s.name, s])), [suggestions]);

  const save: SaveFn = useCallback(
    async (id, entries) => {
      const current = recordsRef.current.find((r) => r.id === id);
      if (!current) return "找不到這筆資料";
      let patch: GrainPatch = {};
      for (const [field, raw] of entries) {
        const parsed = parseField(field, raw);
        if (!parsed.ok) {
          showError(parsed.error);
          return parsed.error;
        }
        patch = { ...patch, ...parsed.patch };
      }
      // 打了姓名、電話地址又是空的 → 從以前的紀錄帶出來
      if (patch.name && !current.phone && !current.address && patch.phone === undefined && patch.address === undefined) {
        const s = suggestionByName.get(patch.name);
        if (s) patch = { ...patch, phone: s.phone, address: s.address };
      }
      return apply(id, patch);
    },
    [showError, suggestionByName, apply, recordsRef],
  );

  const add = useCallback(async () => {
    const result = await createGrainRecord(site.id);
    if (!result.ok) {
      showError(result.error);
      return null;
    }
    setRecords((rs) => [...rs, result.data]);
    setFocusId(result.data.id);
    router.refresh(); // 更新收購點分頁上的筆數
    return result.data;
  }, [site.id, showError, router]);

  const remove = useCallback(
    /** 回傳是否真的刪除（使用者按取消時為 false） */
    async (id: number): Promise<boolean> => {
      const current = recordsRef.current.find((r) => r.id === id);
      if (!current) return false;
      if (!confirm(`刪除「${current.name || "（沒有姓名）"}」這一筆？週報表的那一筆也會一起刪除。`)) return false;
      setRecords((rs) => rs.filter((r) => r.id !== id));
      const result = await deleteGrainRecord(id);
      if (!result.ok) {
        setRecords((rs) => [...rs, current].sort((a, b) => a.seq - b.seq));
        showError(result.error);
        return false;
      }
      router.refresh();
      return true;
    },
    [showError, router],
  );

  const rows: Row[] = useMemo(
    () =>
      records.map((record) => ({
        record,
        saving: saving.has(record.id),
        calc: calcGrain(
          { kg: record.kg, fen: record.fen, deposit: record.deposit, collectOverride: record.collectOverride },
          rates,
          effectiveRoundingMode(record.roundingMode, site.roundingMode),
        ),
      })),
    [records, saving, site.roundingMode, rates],
  );

  const totalKg = rows.reduce((n, r) => n + (r.record.kg ?? 0), 0);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-black/60">
        <span className="font-bold text-black">{site.name}</span>
        <span className="tabular">{rows.length} 筆</span>
        <span className="tabular">{fmt(totalKg)} 公斤</span>
        {site.roundingMode === "none" && <span>利、運費不捨去</span>}
      </div>

      <datalist id="farmer-names">
        {suggestions.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>

      <div className="hidden md:block">
        <GrainGrid rows={rows} save={save} add={add} remove={remove} focusId={focusId} onFocused={() => setFocusId(null)} />
      </div>
      <div className="md:hidden">
        <GrainCards rows={rows} save={save} add={add} remove={remove} />
      </div>

      <Toast message={error} />
    </>
  );
}

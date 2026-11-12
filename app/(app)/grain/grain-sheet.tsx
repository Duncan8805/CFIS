"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGrainRecord,
  deleteGrainRecord,
  updateGrainRecord,
} from "@/app/actions/grain";
import {
  calcGrain,
  effectiveRoundingMode,
  type RoundingMode,
} from "@/lib/calc";
import type { FarmerDto } from "@/lib/data/farmers";
import type { CalcSettings } from "@/lib/data/settings";
import {
  parseField,
  suggestPlanGuide,
  totalKg,
  type EditableField,
  type GrainPatch,
  type GrainRecordDto,
} from "@/lib/grain/fields";
import { buttonClass, PageHeader } from "@/components/page-header";
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
export type SaveFn = (
  id: number,
  entries: [EditableField, string][],
) => Promise<string | null>;

const recordId = (r: GrainRecordDto) => r.id;

export const fmt = (n: number | null) =>
  n === null ? "" : n.toLocaleString("zh-TW", { maximumFractionDigits: 2 });

export function GrainSheet({
  site,
  settings,
  initialRecords,
  farmers,
}: {
  site: SheetSite;
  /** 這一期的計算參數（每分利、每公斤運費、每公頃計畫／輔導收購量） */
  settings: CalcSettings;
  initialRecords: GrainRecordDto[];
  /** 農民名冊：打檔號或姓名時帶出資料 */
  farmers: FarmerDto[];
}) {
  const router = useRouter();
  const { message: toast, tone, show: showToast } = useToast();
  const [focusId, setFocusId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
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
    onError: showToast,
  });

  const byFileNo = useMemo(
    () => new Map(farmers.filter((f) => f.fileNo).map((f) => [f.fileNo!, f])),
    [farmers],
  );
  const byName = useMemo(() => {
    const m = new Map<string, FarmerDto>();
    for (const f of farmers)
      if (f.name && (f.phone || f.address) && !m.has(f.name)) m.set(f.name, f);
    return m;
  }, [farmers]);

  const save: SaveFn = useCallback(
    async (id, entries) => {
      const current = recordsRef.current.find((r) => r.id === id);
      if (!current) return "找不到這筆資料";
      let patch: GrainPatch = {};
      for (const [field, raw] of entries) {
        const parsed = parseField(field, raw);
        if (!parsed.ok) {
          showToast(parsed.error);
          return parsed.error;
        }
        patch = { ...patch, ...parsed.patch };
      }
      const blank = (k: "name" | "phone" | "address") =>
        patch[k] === undefined && !current[k];

      // 打了檔號 → 從名冊帶出姓名、電話、地址（只補空白的，不蓋掉已經填的）
      if (patch.fileNo) {
        const f = byFileNo.get(patch.fileNo);
        if (f) {
          if (blank("name") && f.name) patch.name = f.name;
          if (blank("phone") && f.phone) patch.phone = f.phone;
          if (blank("address") && f.address) patch.address = f.address;
          const name = patch.name ?? current.name;
          if (name && f.name && name !== f.name)
            showToast(
              `名冊上 ${patch.fileNo} 是「${f.name}」，這一筆寫的是「${name}」，請確認`,
              "info",
            );
        } else {
          showToast(`名冊還沒有 ${patch.fileNo}，存檔後會自動加進名冊`, "info");
        }
      }
      // 打了姓名、電話地址又是空的 → 從名冊帶出來
      if (patch.name && blank("phone") && blank("address")) {
        const f = byName.get(patch.name);
        if (f) patch = { ...patch, phone: f.phone, address: f.address };
      }
      // 打了核定面積、計畫輔導都還空著 → 依這一期每公頃的收購量先算出建議數量
      if (
        patch.fen &&
        current.planKg === null &&
        current.guideKg === null &&
        patch.planKg === undefined &&
        patch.guideKg === undefined
      ) {
        patch = {
          ...patch,
          ...suggestPlanGuide(
            patch.fen,
            settings.planKgPerHa,
            settings.guideKgPerHa,
          ),
        };
      }
      return apply(id, patch);
    },
    [
      showToast,
      byFileNo,
      byName,
      apply,
      recordsRef,
      settings.planKgPerHa,
      settings.guideKgPerHa,
    ],
  );

  const add = useCallback(async () => {
    const result = await createGrainRecord(site.id);
    if (!result.ok) {
      showToast(result.error);
      return null;
    }
    setQuery("");
    setRecords((rs) => [...rs, result.data]);
    setFocusId(result.data.id);
    router.refresh(); // 更新收購點選單上的筆數
    return result.data;
  }, [site.id, showToast, router, setRecords]);

  const remove = useCallback(
    /** 回傳是否真的刪除（使用者按取消時為 false） */
    async (id: number): Promise<boolean> => {
      const current = recordsRef.current.find((r) => r.id === id);
      if (!current) return false;
      if (
        !confirm(
          `刪除「${current.name || "（沒有姓名）"}」這一筆？週報表的那一筆也會一起刪除。`,
        )
      )
        return false;
      setRecords((rs) => rs.filter((r) => r.id !== id));
      const result = await deleteGrainRecord(id);
      if (!result.ok) {
        setRecords((rs) => [...rs, current].sort((a, b) => a.seq - b.seq));
        showToast(result.error);
        return false;
      }
      router.refresh();
      return true;
    },
    [showToast, router, recordsRef, setRecords],
  );

  const rows: Row[] = useMemo(
    () =>
      records
        // 公斤＝計畫＋輔導：打完馬上顯示，不用等伺服器回來（伺服器存的也是同一個算法）
        .map((r) => ({ ...r, kg: totalKg(r.planKg, r.guideKg, r.kg) }))
        .map((record) => ({
          record,
          saving: saving.has(record.id),
          calc: calcGrain(
            {
              kg: record.kg,
              fen: record.fen,
              deposit: record.deposit,
              collectOverride: record.collectOverride,
            },
            settings.rates,
            effectiveRoundingMode(record.roundingMode, site.roundingMode),
          ),
        })),
    [records, saving, site.roundingMode, settings.rates],
  );

  const q = query.trim().toUpperCase();
  const shown = q
    ? rows.filter(({ record: r }) =>
        [r.name, r.phone, r.fileNo, r.code].some(
          (v) => v && v.toUpperCase().includes(q),
        ),
      )
    : rows;

  const sum = (pick: (r: Row) => number | null) =>
    rows.reduce((n, r) => n + (pick(r) ?? 0), 0);
  const totals = [
    { label: "筆數", value: fmt(rows.length) },
    { label: "公斤", value: fmt(sum((r) => r.record.kg)) },
    { label: "利", value: fmt(sum((r) => r.calc.interest)), muted: true },
    { label: "運費", value: fmt(sum((r) => r.calc.freight)), muted: true },
    { label: "入簿", value: fmt(sum((r) => r.record.deposit)) },
    // 入簿還沒填的（農會還沒撥款）收 先不算
    { label: "收", value: fmt(sum((r) => (r.record.deposit === null ? 0 : r.calc.collect))), brand: true },
  ];

  return (
    <>
      <PageHeader
        eyebrow="公糧"
        title={site.name}
        description={
          site.roundingMode === "none"
            ? "這個收購點的利、運費不捨去（保留小數）"
            : undefined
        }
        actions={
          <>
            <label className="flex h-[42px] min-w-0 items-center gap-2 rounded-[10px] border border-field bg-white px-3 text-muted focus-within:border-brand-500 sm:min-w-56">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="size-[18px] shrink-0"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="找姓名、電話或檔號"
                placeholder="找姓名、電話或檔號"
                className="min-w-0 flex-1 bg-transparent text-ink outline-none"
              />
            </label>
            <button
              type="button"
              onClick={add}
              className={`${buttonClass.primary} hidden md:inline-flex`}
            >
              ＋ 新增一筆
            </button>
          </>
        }
      />

      <section
        aria-label="合計"
        className="tabular mb-4 grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-white xl:grid-cols-6"
      >
        {totals.map((t) => (
          <div
            key={t.label}
            className="border-l border-line-soft px-3 py-2.5 first:border-l-0 md:px-4 md:py-3"
          >
            <div className="text-xs text-muted">{t.label}</div>
            <div
              className={`truncate text-base font-bold md:text-xl ${t.brand ? "text-brand-700" : t.muted ? "text-muted" : "text-ink"}`}
            >
              {t.value}
            </div>
          </div>
        ))}
      </section>

      <datalist id="farmer-names">
        {[...byName.keys()].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="farmer-file-nos">
        {[...byFileNo.values()].map((f) => (
          <option key={f.fileNo} value={f.fileNo!}>
            {f.name}
          </option>
        ))}
      </datalist>

      <div className="hidden md:block">
        <GrainGrid
          rows={shown}
          filtered={!!q}
          save={save}
          add={add}
          remove={remove}
          focusId={focusId}
          onFocused={() => setFocusId(null)}
        />
        <footer className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${saving.size ? "animate-pulse bg-warn-500" : "bg-brand-600"}`}
            />
            {saving.size ? "儲存中…" : "全部已儲存"}
          </span>
          <span>方向鍵移動・Enter 往下・Esc 取消・離開格子自動儲存</span>
          <span>
            公斤＝計畫＋輔導；從舊 Excel
            匯入的資料只有公斤，補上兩欄後公斤會改成自動加總
          </span>
        </footer>
      </div>
      <div className="md:hidden">
        <GrainCards
          rows={shown}
          save={save}
          add={add}
          remove={remove}
          preview={(r) =>
            calcGrain(
              {
                kg: r.kg,
                fen: r.fen,
                deposit: r.deposit,
                collectOverride: r.collectOverride,
              },
              settings.rates,
              effectiveRoundingMode(r.roundingMode, site.roundingMode),
            )
          }
        />
      </div>

      <Toast message={toast} tone={tone} />
    </>
  );
}

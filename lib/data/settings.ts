import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_GRAIN_RATES, DEFAULT_MOISTURE_RATES, type GrainRates, type MoistureRate } from "@/lib/calc";
import type { Period } from "./period";

export const SETTING_KEYS = {
  interestPerFen: "grain.interestPerFen",
  freightPerKg: "grain.freightPerKg",
  vendorName: "report.vendorName",
} as const;

export interface CalcSettings {
  rates: GrainRates;
  moistureRates: MoistureRate[];
  /** 每公頃計畫收購、輔導收購公斤；有填才會幫忙算建議數量 */
  planKgPerHa: number | null;
  guideKgPerHa: number | null;
  /** 週報表標題上的「繳交業者」（所有期別共用） */
  vendorName: string;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 某一期的計算參數：每分利、每公斤運費、水分折算率、每公頃計畫／輔導收購量。
 * 期別上沒填的（第一期建立時還沒有這些欄位）沿用系統設定。
 */
export async function getCalcSettings(period: Period): Promise<CalcSettings> {
  const db = getDb();
  const [rows, rates] = await Promise.all([
    db.select().from(schema.settings),
    period.moistureRates?.length
      ? Promise.resolve(period.moistureRates)
      : db.select().from(schema.moistureRates).orderBy(asc(schema.moistureRates.moisture)),
  ]);
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const vendor = get(SETTING_KEYS.vendorName);
  return {
    rates: {
      interestPerFen:
        period.interestPerFen ?? asNumber(get(SETTING_KEYS.interestPerFen), DEFAULT_GRAIN_RATES.interestPerFen),
      freightPerKg: period.freightPerKg ?? asNumber(get(SETTING_KEYS.freightPerKg), DEFAULT_GRAIN_RATES.freightPerKg),
    },
    moistureRates: (rates.length ? rates : DEFAULT_MOISTURE_RATES)
      .map((r) => ({ moisture: Number(r.moisture), rate: Number(r.rate) }))
      .sort((a, b) => a.moisture - b.moisture),
    planKgPerHa: period.planKgPerHa,
    guideKgPerHa: period.guideKgPerHa,
    vendorName: typeof vendor === "string" && vendor.trim() ? vendor : "長富",
  };
}

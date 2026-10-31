import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_GRAIN_RATES, DEFAULT_MOISTURE_RATES, type GrainRates, type MoistureRate } from "@/lib/calc";

export const SETTING_KEYS = {
  interestPerFen: "grain.interestPerFen",
  freightPerKg: "grain.freightPerKg",
  vendorName: "report.vendorName",
} as const;

export interface CalcSettings {
  rates: GrainRates;
  moistureRates: MoistureRate[];
  /** 週報表標題上的「繳交業者」 */
  vendorName: string;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** 計算用的設定：每分利、每公斤運費、水分折算率表。設定頁改了，各頁計算就跟著變。 */
export async function getCalcSettings(): Promise<CalcSettings> {
  const db = getDb();
  const [rows, rates] = await Promise.all([
    db.select().from(schema.settings),
    db.select().from(schema.moistureRates).orderBy(asc(schema.moistureRates.moisture)),
  ]);
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const vendor = get(SETTING_KEYS.vendorName);
  return {
    rates: {
      interestPerFen: asNumber(get(SETTING_KEYS.interestPerFen), DEFAULT_GRAIN_RATES.interestPerFen),
      freightPerKg: asNumber(get(SETTING_KEYS.freightPerKg), DEFAULT_GRAIN_RATES.freightPerKg),
    },
    moistureRates: rates.length ? rates : DEFAULT_MOISTURE_RATES,
    vendorName: typeof vendor === "string" && vendor.trim() ? vendor : "長富",
  };
}

import { roundDivide, toScaled } from "./exact";

/**
 * 週報表每列的計算（對應 Excel 欄位）：
 *   濕稻穀折算 F = IF(水分 < 24, 0, VLOOKUP(水分, 折算率表, 2, TRUE))
 *   濕稻穀數量 D = IF(F = 0, "", ROUND(公斤 / F, 0))
 */

export interface MoistureRate {
  moisture: number;
  rate: number;
}

/** 濕稻穀含水量 → 折算率（週報表「濕稻穀折算率Data」工作表） */
export const DEFAULT_MOISTURE_RATES: MoistureRate[] = [
  { moisture: 24, rate: 0.83 },
  { moisture: 25, rate: 0.82 },
  { moisture: 26, rate: 0.81 },
  { moisture: 27, rate: 0.8 },
  { moisture: 28, rate: 0.79 },
  { moisture: 29, rate: 0.78 },
  { moisture: 30, rate: 0.76 },
  { moisture: 31, rate: 0.74 },
  { moisture: 32, rate: 0.72 },
];

/** VLOOKUP(…, TRUE)：找不大於水分的最大一列。低於表內最小值（24）或空白時為 0。 */
export function lookupMoistureRate(
  moisture: number | null | undefined,
  table: MoistureRate[] = DEFAULT_MOISTURE_RATES,
): number {
  if (moisture === null || moisture === undefined) return 0;
  const sorted = [...table].sort((a, b) => a.moisture - b.moisture);
  let rate = 0;
  for (const row of sorted) {
    if (row.moisture <= moisture) rate = row.rate;
    else break;
  }
  return rate;
}

/** 濕稻穀數量；折算率為 0 時回傳 null（Excel 顯示空白）。 */
export function calcWetQuantity(kg: number | null, rate: number): number | null {
  if (!rate) return null;
  return roundDivide(toScaled(kg), toScaled(rate));
}

export function calcWeekly(
  input: { kg: number | null; moisture: number | null },
  table: MoistureRate[] = DEFAULT_MOISTURE_RATES,
) {
  const rate = lookupMoistureRate(input.moisture, table);
  return { rate, wetQuantity: calcWetQuantity(input.kg, rate) };
}

export type RemarkMode = "farmer_phone" | "agent_contact";

/**
 * 週報表備註：一般收購點填農民電話；代收人的表（東石珍等）預設填代收人電話。
 * 個別紀錄可覆寫（東石珍的張設奇、涂黃秋蓮就是覆寫成自己的電話）。
 */
export function weeklyRemark(opts: {
  mode: RemarkMode;
  farmerPhone: string | null;
  agentContact: string | null;
  override?: string | null;
}): string {
  if (opts.override !== null && opts.override !== undefined) return opts.override;
  const value = opts.mode === "agent_contact" ? opts.agentContact : opts.farmerPhone;
  return value ?? "";
}

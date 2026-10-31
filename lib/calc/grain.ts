import { SCALE, toScaled, truncate } from "./exact";

/**
 * 公糧表每列的計算（對應 Excel 欄位）：
 *   利   F = ROUNDDOWN(分 × 每分利, 0)
 *   運費 G = ROUNDDOWN(公斤 × 每公斤運費, 0)
 *   先付 H = 利 − 運費
 *   收   J = 入簿 − 先付（可被手動文字取代，例如「扣」「5/24扣」）
 *
 * 朴子、鹿草等幾張表的利與運費沒有 ROUNDDOWN（roundingMode = "none"），保留小數。
 */

export type RoundingMode = "truncate" | "none";

export interface GrainRates {
  /** 每分的利，目前為 4000 */
  interestPerFen: number;
  /** 每公斤運費，目前為 0.35 */
  freightPerKg: number;
}

export const DEFAULT_GRAIN_RATES: GrainRates = { interestPerFen: 4000, freightPerKg: 0.35 };

/** 這一筆實際用的捨入方式：紀錄自己有設定就用紀錄的，否則用收購點的 */
export function effectiveRoundingMode(record: RoundingMode | null | undefined, site: RoundingMode): RoundingMode {
  return record ?? site;
}

export interface GrainInput {
  kg: number | null;
  fen: number | null;
  deposit: number | null;
  /** 收 欄的手動文字（例如「扣」），有值時取代計算結果 */
  collectOverride?: string | null;
}

export interface GrainResult {
  interest: number;
  freight: number;
  prepaid: number;
  /** 收 的計算值；有 collectOverride 時為 null */
  collect: number | null;
  /** 收 的手動文字 */
  collectText: string | null;
}

// 兩個放大 10000 倍的數相乘 → 放大 10^8 倍
const SCALE2 = SCALE * SCALE;

export function calcGrain(
  input: GrainInput,
  rates: GrainRates = DEFAULT_GRAIN_RATES,
  mode: RoundingMode = "truncate",
): GrainResult {
  const interestRaw = toScaled(input.fen) * toScaled(rates.interestPerFen);
  const freightRaw = toScaled(input.kg) * toScaled(rates.freightPerKg);

  const interestScaled = mode === "truncate" ? truncate(interestRaw, SCALE2) * SCALE2 : interestRaw;
  const freightScaled = mode === "truncate" ? truncate(freightRaw, SCALE2) * SCALE2 : freightRaw;
  const prepaidScaled = interestScaled - freightScaled;

  const text = input.collectOverride?.trim();
  const collect = text ? null : (toScaled(input.deposit) * SCALE - prepaidScaled) / SCALE2;

  return {
    interest: interestScaled / SCALE2,
    freight: freightScaled / SCALE2,
    prepaid: prepaidScaled / SCALE2,
    collect,
    collectText: text || null,
  };
}

/**
 * 隨機產生水分，照週報表「GenerateNumbers」巨集的機率：
 *   24: 10%  25: 10%  26: 30%  27: 30%  28: 10%  29: 5%  30: 5%
 * 一次產生 2 筆以上時，保證至少有一個 30。
 *
 * 原巨集沒有先呼叫 Randomize，每次開 Excel 第一次產生的順序都一樣；這裡沒有這個問題。
 */

export const MOISTURE_WEIGHTS: ReadonlyArray<readonly [moisture: number, cumulative: number]> = [
  [24, 0.1],
  [25, 0.2],
  [26, 0.5],
  [27, 0.8],
  [28, 0.9],
  [29, 0.95],
  [30, 1],
];

export const GUARANTEED_MOISTURE = 30;

export function randomMoisture(rng: () => number = Math.random): number {
  const r = rng();
  for (const [moisture, cumulative] of MOISTURE_WEIGHTS) {
    if (r < cumulative) return moisture;
  }
  return GUARANTEED_MOISTURE;
}

export function randomMoistures(count: number, rng: () => number = Math.random): number[] {
  const values = Array.from({ length: count }, () => randomMoisture(rng));
  if (count >= 2 && !values.includes(GUARANTEED_MOISTURE)) {
    values[Math.floor(rng() * count)] = GUARANTEED_MOISTURE;
  }
  return values;
}

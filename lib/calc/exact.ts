// Excel 的 ROUNDDOWN / ROUND 在浮點數上會出現 1643.9499999 這類誤差，
// 這裡把數值放大成整數再運算，確保跟 Excel 算出來的結果一致。

export const SCALE = 10_000;

/** 把最多 4 位小數的數值轉成整數（×10000）。空白視為 0，跟 Excel 空白儲存格一樣。 */
export function toScaled(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.round(value * SCALE);
}

/** Excel ROUNDDOWN(x, 0)：往 0 的方向捨去。 */
export function truncate(scaled: number, scale: number): number {
  return Math.trunc(scaled / scale);
}

/** Excel ROUND(n / d, 0)：四捨五入，.5 遠離 0。n、d 為整數，d > 0。 */
export function roundDivide(n: number, d: number): number {
  const sign = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  return sign * Math.floor((2 * a + d) / (2 * d));
}

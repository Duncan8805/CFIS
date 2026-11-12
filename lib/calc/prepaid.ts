import { calcGrain, type GrainRates, type RoundingMode } from "./grain";

/**
 * 先付資金試算：把一整期的公糧紀錄用另一組「每分利、每公斤運費」重算，
 * 看先付（要先拿出去的錢）、運費、收 會變多少。
 *
 * 每一筆照原本的規則各自算（含 ROUNDDOWN），再加總，所以跟公糧表的合計一致。
 */

export interface PrepaidRow {
  siteId: number;
  /** 公斤；estimated = true 時是用 核定面積 × 每公頃收購量 估出來的 */
  kg: number | null;
  estimated: boolean;
  fen: number | null;
  deposit: number | null;
  /** 收 欄寫了「扣」之類的文字：不算 收 */
  hasCollectText: boolean;
  mode: RoundingMode;
}

export interface PrepaidTotals {
  count: number;
  kg: number;
  /** 用面積估算公斤的筆數、公斤 */
  estimatedCount: number;
  estimatedKg: number;
  interest: number;
  freight: number;
  prepaid: number;
  /** 只算有入簿、收 沒有手動文字的那些筆 */
  collect: number;
}

export interface PrepaidResult {
  totals: PrepaidTotals;
  bySite: Map<number, PrepaidTotals>;
}

const zero = (): PrepaidTotals => ({
  count: 0,
  kg: 0,
  estimatedCount: 0,
  estimatedKg: 0,
  interest: 0,
  freight: 0,
  prepaid: 0,
  collect: 0,
});

// 金額加總用整數分（×100）避免浮點誤差
const add = (a: number, b: number) => Math.round((a + b) * 100) / 100;

export function simulatePrepaid(rows: PrepaidRow[], rates: GrainRates): PrepaidResult {
  const totals = zero();
  const bySite = new Map<number, PrepaidTotals>();
  for (const r of rows) {
    let s = bySite.get(r.siteId);
    if (!s) bySite.set(r.siteId, (s = zero()));
    const c = calcGrain(
      { kg: r.kg, fen: r.fen, deposit: r.deposit, collectOverride: r.hasCollectText ? "扣" : null },
      rates,
      r.mode,
    );
    for (const t of [s, totals]) {
      t.count++;
      t.kg += r.kg ?? 0;
      if (r.estimated) {
        t.estimatedCount++;
        t.estimatedKg += r.kg ?? 0;
      }
      t.interest = add(t.interest, c.interest);
      t.freight = add(t.freight, c.freight);
      t.prepaid = add(t.prepaid, c.prepaid);
      if (r.deposit !== null && c.collect !== null) t.collect = add(t.collect, c.collect);
    }
  }
  return { totals, bySite };
}

/** 損益兩平：每公斤運費要多少，先付才會等於 0（利全部被運費吃掉） */
export function breakEvenFreight(totals: Pick<PrepaidTotals, "interest" | "kg">): number | null {
  return totals.kg > 0 ? totals.interest / totals.kg : null;
}

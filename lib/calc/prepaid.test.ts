import { describe, expect, it } from "vitest";
import { breakEvenFreight, simulatePrepaid, type PrepaidRow } from "./prepaid";

const row = (over: Partial<PrepaidRow>): PrepaidRow => ({
  siteId: 1,
  kg: 1000,
  estimated: false,
  fen: 0.5,
  deposit: 5000,
  hasCollectText: false,
  mode: "truncate",
  ...over,
});

describe("先付試算", () => {
  const rates = { interestPerFen: 4000, freightPerKg: 0.35 };

  it("每筆照公糧表的公式算再加總", () => {
    // 利 = 0.5 × 4000 = 2000，運費 = 1000 × 0.35 = 350，先付 = 1650，收 = 5000 − 1650
    const { totals } = simulatePrepaid([row({}), row({ siteId: 2 })], rates);
    expect(totals).toMatchObject({ count: 2, kg: 2000, interest: 4000, freight: 700, prepaid: 3300, collect: 6700 });
  });

  it("每筆各自捨去，不是加總後才捨去", () => {
    // 5 × 0.35 = 1.75 → 1，兩筆合計 2（若加總後才捨去會是 3.5 → 3）
    const { totals } = simulatePrepaid([row({ kg: 5, fen: 0 }), row({ kg: 5, fen: 0 })], rates);
    expect(totals.freight).toBe(2);
  });

  it("收購點設定不捨去時保留小數", () => {
    const { totals } = simulatePrepaid([row({ kg: 5, fen: 0, mode: "none" })], rates);
    expect(totals.freight).toBe(1.75);
  });

  it("依收購點分開加總", () => {
    const { bySite } = simulatePrepaid([row({ siteId: 1 }), row({ siteId: 1 }), row({ siteId: 2, kg: 2000 })], rates);
    expect(bySite.get(1)?.prepaid).toBe(3300);
    expect(bySite.get(2)?.freight).toBe(700);
  });

  it("入簿空白、收 寫「扣」的不算 收，但仍算先付", () => {
    const { totals } = simulatePrepaid([row({ deposit: null }), row({ hasCollectText: true })], rates);
    expect(totals.prepaid).toBe(3300);
    expect(totals.collect).toBe(0);
  });

  it("估算的公斤另外計數", () => {
    const { totals } = simulatePrepaid([row({}), row({ kg: 800, estimated: true })], rates);
    expect(totals).toMatchObject({ estimatedCount: 1, estimatedKg: 800, kg: 1800 });
  });

  it("換一組利率、運費就照新的算", () => {
    const { totals } = simulatePrepaid([row({})], { interestPerFen: 3800, freightPerKg: 0.4 });
    expect(totals).toMatchObject({ interest: 1900, freight: 400, prepaid: 1500 });
  });

  it("損益兩平運費 = 利 ÷ 公斤", () => {
    expect(breakEvenFreight({ interest: 2000, kg: 1000 })).toBe(2);
    expect(breakEvenFreight({ interest: 2000, kg: 0 })).toBeNull();
  });
});

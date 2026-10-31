import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/dongshi-zhen.json";
import {
  calcGrain,
  calcWeekly,
  lookupMoistureRate,
  paginate,
  randomMoistures,
  weeklyRemark,
} from "./index";

// 比對基準：東石珍（公糧表與週報表兩邊），數值從 Excel 直接讀出
describe("公糧計算：東石珍逐列跟 Excel 一致", () => {
  fixture.grain.forEach((row, i) => {
    it(`第 ${i + 1} 筆`, () => {
      const r = calcGrain({ kg: row.kg, fen: row.fen, deposit: row.deposit });
      expect(r.interest).toBe(row.expected.interest);
      expect(r.freight).toBe(row.expected.freight);
      expect(r.prepaid).toBe(row.expected.prepaid);
      expect(r.collect).toBe(row.expected.collect);
    });
  });
});

describe("公糧計算：不捨去的收購點（朴子阿財）", () => {
  fixture.grainNoTruncate.forEach((row, i) => {
    it(`第 ${i + 1} 筆`, () => {
      const r = calcGrain({ kg: row.kg, fen: row.fen, deposit: row.deposit }, undefined, "none");
      expect(r.interest).toBeCloseTo(row.expected.interest, 6);
      expect(r.freight).toBeCloseTo(row.expected.freight, 6);
      expect(r.prepaid).toBeCloseTo(row.expected.prepaid, 6);
      expect(r.collect).toBeCloseTo(row.expected.collect, 6);
    });
  });
});

describe("公糧計算：收 欄手動文字", () => {
  it("填「扣」時不計算收", () => {
    const r = calcGrain({ kg: 5662, fen: 1.742, deposit: 159249, collectOverride: "扣" });
    expect(r.collect).toBeNull();
    expect(r.collectText).toBe("扣");
    expect(r.prepaid).toBe(4987);
  });
  it("空白欄位視為 0（跟 Excel 一樣）", () => {
    const r = calcGrain({ kg: null, fen: null, deposit: null });
    expect(r).toMatchObject({ interest: 0, freight: 0, prepaid: 0, collect: 0 });
  });
});

describe("週報表計算：東石珍逐列跟 Excel 一致", () => {
  fixture.weekly.forEach((row, i) => {
    it(`第 ${i + 1} 筆`, () => {
      const r = calcWeekly({ kg: row.kg, moisture: row.moisture });
      expect(r.rate).toBe(row.expected.rate);
      expect(r.wetQuantity).toBe(row.expected.wetQuantity);
    });
  });

  it("公斤跟公糧表相同（東石珍的帶入規則）", () => {
    expect(fixture.weekly.map((w) => w.kg)).toEqual(fixture.grain.map((g) => g.kg));
  });
});

describe("折算率查表（VLOOKUP 近似比對）", () => {
  it.each([
    [null, 0],
    [23, 0],
    [24, 0.83],
    [26.5, 0.81],
    [32, 0.72],
    [35, 0.72],
  ])("水分 %s → %s", (moisture, rate) => {
    expect(lookupMoistureRate(moisture)).toBe(rate);
  });

  it("折算率為 0 時濕穀數量為空白", () => {
    expect(calcWeekly({ kg: 1000, moisture: 20 }).wetQuantity).toBeNull();
  });
});

describe("週報表備註", () => {
  const agent = "珍0910163244/3703527";
  it("代收人的表預設填代收人電話", () => {
    expect(weeklyRemark({ mode: "agent_contact", farmerPhone: "3790684", agentContact: agent })).toBe(agent);
  });
  it("可以逐筆覆寫（例如張設奇填自己的電話）", () => {
    expect(
      weeklyRemark({ mode: "agent_contact", farmerPhone: "x", agentContact: agent, override: "0903139657" }),
    ).toBe("0903139657");
  });
  it("一般收購點填農民電話", () => {
    expect(weeklyRemark({ mode: "farmer_phone", farmerPhone: "0919604639", agentContact: null })).toBe(
      "0919604639",
    );
  });
});

describe("隨機水分", () => {
  it("只產生 24–30", () => {
    const values = randomMoistures(500);
    expect(values.every((v) => v >= 24 && v <= 30)).toBe(true);
  });
  it("2 筆以上保證至少一個 30", () => {
    const alwaysLow = () => 0; // 永遠抽到 24
    const values = randomMoistures(10, alwaysLow);
    expect(values).toContain(30);
    expect(values.filter((v) => v === 30)).toHaveLength(1);
  });
  it("機率分布接近巨集設定", () => {
    const n = 20000;
    const values = randomMoistures(n);
    const share = (m: number) => values.filter((v) => v === m).length / n;
    expect(share(26)).toBeGreaterThan(0.27);
    expect(share(26)).toBeLessThan(0.33);
    expect(share(29)).toBeGreaterThan(0.03);
    expect(share(29)).toBeLessThan(0.07);
  });
});

describe("每 26 筆分頁小計", () => {
  it("東石珍 14 筆：一頁，小計 = 總合計 = 47,453", () => {
    const { pages, totalKg } = paginate(fixture.grain, (r) => r.kg);
    expect(pages).toHaveLength(1);
    expect(pages[0].subtotalKg).toBe(47453);
    expect(totalKg).toBe(47453);
  });
  it("53 筆分成 26 / 26 / 1", () => {
    const rows = Array.from({ length: 53 }, () => ({ kg: 1 }));
    const { pages, totalKg } = paginate(rows, (r) => r.kg);
    expect(pages.map((p) => p.subtotalKg)).toEqual([26, 26, 1]);
    expect(totalKg).toBe(53);
  });
});

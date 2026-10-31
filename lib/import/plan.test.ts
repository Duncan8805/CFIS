import { describe, expect, it } from "vitest";
import type { GrainRow, WeeklyRow } from "./excel";
import { buildImportPlan, type SiteConfig } from "./plan";

// 合成資料，不含真實姓名電話
const site: SiteConfig = {
  id: 1,
  name: "代收點",
  weeklySheetName: "代收點",
  sellTo: "東石",
  remarkMode: "agent_contact",
  agentContact: null,
  roundingMode: "truncate",
};

const grain = (row: number, name: string, kg: number, extra: Partial<GrainRow> = {}): GrainRow => ({
  sheet: "代收點",
  row,
  code: null,
  name,
  phone: null,
  address: null,
  kg,
  fen: 0.4012,
  deposit: 36512,
  collectOverride: null,
  excel: { interest: 1604, freight: Math.trunc(kg * 0.35), prepaid: 1604 - Math.trunc(kg * 0.35), collect: null },
  ...extra,
});

const weekly = (row: number, name: string, kg: number, remark = "代收人0900"): WeeklyRow => ({
  sheet: "代收點",
  row,
  intakeDate: "2026-06-28",
  name,
  kg,
  moisture: 26,
  sellTo: "東石",
  plannedSellDate: null,
  remark,
});

describe("匯入計畫：週報表配對", () => {
  it("順序、姓名、公斤都相同時一對一配對，沒有問題", () => {
    const plan = buildImportPlan(
      [grain(3, "甲", 1304), grain(4, "乙", 2000)],
      [weekly(3, "甲", 1304), weekly(4, "乙", 2000)],
      [site],
    );
    const p = plan.sites[0];
    expect(p.weeklyMatched).toBe(2);
    expect(p.issues).toEqual([]);
    expect(p.records.map((r) => r.seq)).toEqual([1, 2]);
    expect(p.records[0].weekly).toMatchObject({ intakeDate: "2026-06-28", moisture: 26, sellToOverride: null });
  });

  it("姓名打錯但公斤相同：仍配對，回報 name_mismatch，以公糧姓名為準", () => {
    const plan = buildImportPlan([grain(3, "張金好", 908)], [weekly(3, "張金妤", 908)], [site]);
    const p = plan.sites[0];
    expect(p.weeklyMatched).toBe(1);
    expect(p.issues.map((i) => i.kind)).toEqual(["name_mismatch"]);
    expect(p.records[0].name).toBe("張金好");
  });

  it("週報表多一列：跳過並回報 weekly_extra，後面照常配對", () => {
    const plan = buildImportPlan(
      [grain(3, "甲", 100), grain(4, "乙", 200)],
      [weekly(3, "甲", 100), weekly(4, "多的", 999), weekly(5, "乙", 200)],
      [site],
    );
    const p = plan.sites[0];
    expect(p.weeklyMatched).toBe(2);
    expect(p.issues.map((i) => i.kind)).toEqual(["weekly_extra"]);
  });

  it("自己的週報表找不到時，到沒有收購點對應的工作表找（例如 三合豐 六腳）", () => {
    const plan = buildImportPlan(
      [grain(3, "甲", 100), grain(4, "乙", 200)],
      [weekly(3, "甲", 100), { ...weekly(3, "乙", 200), sheet: "三合豐 六腳", sellTo: "三合豐→六腳" }],
      [site],
    );
    const p = plan.sites[0];
    expect(p.weeklyMatched).toBe(2);
    expect(p.issues).toEqual([]);
    expect(p.records[1].weekly?.sellToOverride).toBe("三合豐→六腳");
    expect(plan.unusedWeeklySheets).toEqual([]);
  });

  it("週報表沒有這個收購點的工作表：列在 missingWeeklySheets", () => {
    const plan = buildImportPlan([grain(3, "甲", 100)], [{ ...weekly(3, "x", 1), sheet: "別的" }], [site]);
    expect(plan.missingWeeklySheets).toEqual(["代收點"]);
  });

  it("公糧有、週報表沒有：回報 weekly_missing", () => {
    const plan = buildImportPlan([grain(3, "甲", 100), grain(4, "乙", 200)], [weekly(3, "甲", 100)], [site]);
    expect(plan.sites[0].issues.map((i) => i.kind)).toEqual(["weekly_missing"]);
    expect(plan.sites[0].records[1].weekly).toBeNull();
  });
});

describe("匯入計畫：備註與繳售業者", () => {
  it("代收人電話取最常出現的備註；跟它不同的才存成覆寫", () => {
    const plan = buildImportPlan(
      [grain(3, "甲", 100), grain(4, "乙", 200), grain(5, "丙", 300)],
      [weekly(3, "甲", 100), weekly(4, "乙", 200), weekly(5, "丙", 300, "0903000000")],
      [site],
    );
    const p = plan.sites[0];
    expect(p.agentContact).toBe("代收人0900");
    expect(p.records.map((r) => r.weekly?.remarkOverride)).toEqual([null, null, "0903000000"]);
  });

  it("一般收購點：備註跟農民電話只差開頭 0 時不算覆寫", () => {
    const farmerSite = { ...site, remarkMode: "farmer_phone" as const };
    const plan = buildImportPlan(
      [grain(3, "甲", 100, { phone: "926150955" })],
      [weekly(3, "甲", 100, "926150955")],
      [farmerSite],
    );
    const p = plan.sites[0];
    expect(p.records[0].phone).toBe("0926150955");
    expect(p.records[0].weekly?.remarkOverride).toBeNull();
    expect(p.issues.map((i) => i.kind)).toEqual(["phone_leading_zero"]);
  });

  it("繳售業者跟收購點預設不同時存成覆寫", () => {
    const plan = buildImportPlan([grain(3, "甲", 100)], [{ ...weekly(3, "甲", 100), sellTo: "三合豐→六腳" }], [site]);
    expect(plan.sites[0].records[0].weekly?.sellToOverride).toBe("三合豐→六腳");
  });
});

describe("匯入計畫：計算驗證", () => {
  it("Excel 的利跟系統算的不同時回報 calc_mismatch", () => {
    const plan = buildImportPlan(
      [grain(3, "甲", 1304, { excel: { interest: 1604.8, freight: 456, prepaid: 1148, collect: null } })],
      [],
      [site],
    );
    expect(plan.sites[0].issues.map((i) => i.kind)).toEqual(["calc_mismatch"]);
  });

  it("找不到收購點的工作表列在 unknownSheets", () => {
    const plan = buildImportPlan([{ ...grain(3, "甲", 1), sheet: "新工作表" }], [], [site]);
    expect(plan.sites).toEqual([]);
    expect(plan.unknownSheets).toEqual(["新工作表"]);
  });
});

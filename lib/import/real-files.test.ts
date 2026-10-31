import fs from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseGrainWorkbook, parseWeeklyWorkbook } from "./excel";
import { buildImportPlan, type SiteConfig } from "./plan";

// 用使用者電腦上的真實 Excel 驗證（檔案含個資，不放進 git）。
// 找不到檔案時整組略過。只檢查數量與問題種類，不在程式碼裡寫任何姓名電話。
const DIR = "C:/Duncan Project/長富整合平台";
const GRAIN = `${DIR}/115年1期公糧最新-test.xlsm`;
const WEEKLY = `${DIR}/公糧周報表最新版.xlsm`;
const available = fs.existsSync(GRAIN) && fs.existsSync(WEEKLY);

async function load(path: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync(path) as unknown as ArrayBuffer);
  return wb;
}

const dongshiZhen: SiteConfig = {
  id: 6,
  name: "東石珍",
  weeklySheetName: "東石珍",
  sellTo: "東石",
  remarkMode: "agent_contact",
  agentContact: null,
  roundingMode: "truncate",
};

describe.skipIf(!available)("真實 Excel：東石珍（比對基準）", () => {
  it("14 筆全部配對，計算跟 Excel 一致，只有 1 個姓名寫法不同", async () => {
    const grain = parseGrainWorkbook(await load(GRAIN));
    const weekly = parseWeeklyWorkbook(await load(WEEKLY));

    expect(grain.skipped).toContain("範例  (2)");
    expect(weekly.skipped).toContain("濕稻穀折算率Data");

    const plan = buildImportPlan(grain.rows, weekly.rows, [dongshiZhen]);
    const p = plan.sites[0];
    expect(p.records).toHaveLength(14);
    expect(p.weeklyMatched).toBe(14);
    expect(p.issues.filter((i) => i.kind === "calc_mismatch")).toEqual([]);
    expect(p.issues.map((i) => i.kind)).toEqual(["name_mismatch"]);
    // 公斤總和 = Excel 的總合計
    expect(p.records.reduce((s, r) => s + (r.kg ?? 0), 0)).toBe(47453);
    // 代收人電話推得出來；有 3 筆備註跟代收人不同（存成覆寫）
    expect(p.agentContact).toBeTruthy();
    expect(p.records.filter((r) => r.weekly?.remarkOverride)).toHaveLength(3);
    expect(p.records.every((r) => r.weekly?.intakeDate?.startsWith("2026-"))).toBe(true);
  });
});

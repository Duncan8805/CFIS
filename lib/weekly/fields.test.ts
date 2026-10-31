import { describe, expect, it } from "vitest";
import { formatDate, parseDate, parseWeeklyField, weeklyFieldText, type WeeklyRowDto } from "./fields";

const defaults = { year: 2026, sellTo: "東石", remark: "珍0910163244/3703527" };

describe("週報表日期", () => {
  it.each([
    ["6/28", "2026-06-28"],
    ["6-28", "2026-06-28"],
    ["6月28日", "2026-06-28"],
    ["0628", "2026-06-28"],
    ["2026-06-28", "2026-06-28"],
    ["115/6/28", "2026-06-28"],
    ["", null],
  ])("「%s」→ %s", (text, iso) => {
    expect(parseDate(text, 2026)).toBe(iso);
  });

  it("不存在的日期擋下", () => {
    expect(parseDate("2/30", 2026)).toBe("invalid");
    expect(parseDate("abc", 2026)).toBe("invalid");
  });

  it("顯示成 Excel 的 6月28日", () => {
    expect(formatDate("2026-06-28")).toBe("6月28日");
    expect(formatDate("2026-07-06")).toBe("7月6日");
    expect(formatDate(null)).toBe("");
  });
});

describe("週報表欄位", () => {
  it("水分：0–100 整數", () => {
    expect(parseWeeklyField("moisture", "26", defaults)).toEqual({ ok: true, patch: { moisture: 26 } });
    expect(parseWeeklyField("moisture", "", defaults)).toEqual({ ok: true, patch: { moisture: null } });
    expect(parseWeeklyField("moisture", "26.5", defaults).ok).toBe(false);
  });

  it("繳售業者：跟預設一樣或清空就不另外存", () => {
    expect(parseWeeklyField("sellTo", "東石", defaults)).toEqual({ ok: true, patch: { sellToOverride: null } });
    expect(parseWeeklyField("sellTo", "", defaults)).toEqual({ ok: true, patch: { sellToOverride: null } });
    expect(parseWeeklyField("sellTo", "三合豐→六腳", defaults)).toEqual({
      ok: true,
      patch: { sellToOverride: "三合豐→六腳" },
    });
  });

  it("備註：跟預設一樣不另外存；清空代表刻意留白", () => {
    expect(parseWeeklyField("remark", defaults.remark, defaults)).toEqual({ ok: true, patch: { remarkOverride: null } });
    expect(parseWeeklyField("remark", "0903139657", defaults)).toEqual({
      ok: true,
      patch: { remarkOverride: "0903139657" },
    });
    expect(parseWeeklyField("remark", "", defaults)).toEqual({ ok: true, patch: { remarkOverride: "" } });
  });

  it("顯示：沒有覆寫時顯示收購點預設", () => {
    const row: WeeklyRowDto = {
      entryId: 1, grainId: 1, seq: 1, name: "甲", kg: 1304, phone: null,
      intakeDate: "2026-06-28", moisture: 26, plannedSellDate: null, sellToOverride: null, remarkOverride: null,
    };
    expect(weeklyFieldText(row, "sellTo", defaults)).toBe("東石");
    expect(weeklyFieldText(row, "remark", defaults)).toBe(defaults.remark);
    expect(weeklyFieldText(row, "intakeDate", defaults)).toBe("6月28日");
    // 顯示的文字再解析回來，值不變
    expect(parseWeeklyField("intakeDate", weeklyFieldText(row, "intakeDate", defaults), defaults)).toEqual({
      ok: true,
      patch: { intakeDate: "2026-06-28" },
    });
  });
});

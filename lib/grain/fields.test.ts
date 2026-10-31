import { describe, expect, it } from "vitest";
import { fieldText, parseField, type GrainRecordDto } from "./fields";

describe("公糧欄位輸入", () => {
  it("公斤、入簿：整數，可以有千分位逗號，空白存成 null", () => {
    expect(parseField("kg", "10,267")).toEqual({ ok: true, patch: { kg: 10267 } });
    expect(parseField("deposit", " 280705 ")).toEqual({ ok: true, patch: { deposit: 280705 } });
    expect(parseField("kg", "")).toEqual({ ok: true, patch: { kg: null } });
    expect(parseField("kg", "12.5").ok).toBe(false);
    expect(parseField("kg", "-3").ok).toBe(false);
    expect(parseField("kg", "abc").ok).toBe(false);
  });

  it("分：最多 4 位小數", () => {
    expect(parseField("fen", "0.4012")).toEqual({ ok: true, patch: { fen: 0.4012 } });
    expect(parseField("fen", "0.40125").ok).toBe(false);
  });

  it("收：只能填文字，清空恢復自動計算", () => {
    expect(parseField("collect", "扣")).toEqual({ ok: true, patch: { collectOverride: "扣" } });
    expect(parseField("collect", "5/24扣")).toEqual({ ok: true, patch: { collectOverride: "5/24扣" } });
    expect(parseField("collect", "")).toEqual({ ok: true, patch: { collectOverride: null } });
    expect(parseField("collect", "35364").ok).toBe(false);
  });

  it("文字欄位：去掉前後空白，太長擋下", () => {
    expect(parseField("name", " 蔡來春 ")).toEqual({ ok: true, patch: { name: "蔡來春" } });
    expect(parseField("phone", "")).toEqual({ ok: true, patch: { phone: null } });
    expect(parseField("name", "名".repeat(33)).ok).toBe(false);
  });

  it("顯示文字跟解析互為反向", () => {
    const r: GrainRecordDto = {
      id: 1, seq: 1, code: null, name: "甲", phone: "0900", address: null,
      kg: 1304, fen: 0.4012, deposit: 36512, collectOverride: null, roundingMode: null,
    };
    for (const f of ["code", "name", "phone", "kg", "fen", "deposit", "collect", "address"] as const) {
      const parsed = parseField(f, fieldText(r, f));
      expect(parsed.ok).toBe(true);
    }
    expect(fieldText(r, "fen")).toBe("0.4012");
    expect(fieldText(r, "collect")).toBe("");
  });
});

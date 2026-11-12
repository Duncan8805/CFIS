import { describe, expect, it } from "vitest";
import { fieldText, parseField, splitPhones, suggestPlanGuide, totalKg, type GrainRecordDto } from "./fields";

describe("公糧欄位輸入", () => {
  it("計畫、輔導、入簿：整數，可以有千分位逗號，空白存成 null", () => {
    expect(parseField("plan", "1,837")).toEqual({ ok: true, patch: { planKg: 1837 } });
    expect(parseField("guide", "1396")).toEqual({ ok: true, patch: { guideKg: 1396 } });
    expect(parseField("deposit", " 280705 ")).toEqual({ ok: true, patch: { deposit: 280705 } });
    expect(parseField("plan", "")).toEqual({ ok: true, patch: { planKg: null } });
    expect(parseField("plan", "12.5").ok).toBe(false);
    expect(parseField("guide", "-3").ok).toBe(false);
    expect(parseField("plan", "abc").ok).toBe(false);
  });

  it("分：最多 4 位小數", () => {
    expect(parseField("fen", "0.4012")).toEqual({ ok: true, patch: { fen: 0.4012 } });
    expect(parseField("fen", "0.40125").ok).toBe(false);
  });

  it("檔號：1 個英文字母加 8 位數字，小寫自動轉大寫", () => {
    expect(parseField("fileNo", "q11101404")).toEqual({ ok: true, patch: { fileNo: "Q11101404" } });
    expect(parseField("fileNo", "")).toEqual({ ok: true, patch: { fileNo: null } });
    expect(parseField("fileNo", "Q1110140").ok).toBe(false);
    expect(parseField("fileNo", "111101404").ok).toBe(false);
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
      id: 1, seq: 1, farmerId: null, fileNo: "Q11101404", code: null, name: "甲", phone: "0900", address: null,
      kg: 3233, planKg: 1837, guideKg: 1396, fen: 0.4012, deposit: 36512, collectOverride: null, roundingMode: null,
    };
    for (const f of ["fileNo", "code", "name", "phone", "fen", "plan", "guide", "deposit", "collect", "address"] as const) {
      const parsed = parseField(f, fieldText(r, f));
      expect(parsed.ok).toBe(true);
    }
    expect(fieldText(r, "fen")).toBe("0.4012");
    expect(fieldText(r, "plan")).toBe("1837");
    expect(fieldText(r, "collect")).toBe("");
  });
});

describe("公斤＝計畫＋輔導", () => {
  it("核定通知單的例子：1,837 ＋ 1,396 ＝ 3,233", () => {
    expect(totalKg(1837, 1396, null)).toBe(3233);
  });
  it("只填一欄時另一欄當 0", () => {
    expect(totalKg(1837, null, 999)).toBe(1837);
  });
  it("兩欄都空白時沿用原本的公斤（舊 Excel 匯入的資料）", () => {
    expect(totalKg(null, null, 10267)).toBe(10267);
  });
});

describe("依核定面積算建議的計畫、輔導", () => {
  it("0.7347 公頃 × 2,500 ＝ 1,837；× 1,900 ＝ 1,396", () => {
    expect(suggestPlanGuide(0.7347, 2500, 1900)).toEqual({ planKg: 1837, guideKg: 1396 });
  });
  it("這一期沒設定每公頃數量就不建議", () => {
    expect(suggestPlanGuide(0.7347, null, null)).toEqual({});
  });
});

describe("電話分行", () => {
  it("用「/」或換行分開，一支一行", () => {
    expect(splitPhones("370-1234 / 0912-345-678")).toEqual(["370-1234", "0912-345-678"]);
    expect(splitPhones("珍0910163244/3703527")).toEqual(["珍0910163244", "3703527"]);
    expect(splitPhones("a\nb")).toEqual(["a", "b"]);
    expect(splitPhones(null)).toEqual([]);
  });
});

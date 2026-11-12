import { describe, expect, it } from "vitest";
import { toHalfWidth } from "./halfwidth";

describe("toHalfWidth", () => {
  it("全形數字", () => expect(toHalfWidth("１２３４")).toBe("1234"));
  it("小數點、負號、千分位", () => {
    expect(toHalfWidth("１２．５")).toBe("12.5");
    expect(toHalfWidth("－３００")).toBe("-300");
    expect(toHalfWidth("１，２３４")).toBe("1,234");
    expect(toHalfWidth("＋５")).toBe("+5");
  });
  it("日期用的斜線、冒號", () => {
    expect(toHalfWidth("１１／１２")).toBe("11/12");
    expect(toHalfWidth("１２：３０")).toBe("12:30");
  });
  it("全形空白轉成一般空白", () => expect(toHalfWidth("１　２")).toBe("1 2"));
  it("半形、全形混在一起", () => expect(toHalfWidth("1２3.４")).toBe("123.4"));
  it("中文字不動", () => expect(toHalfWidth("６月２８日")).toBe("6月28日"));
  it("全形英文字母（檔號）", () => expect(toHalfWidth("Ｑ１１１０１４０４")).toBe("Q11101404"));
});

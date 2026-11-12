import { describe, expect, it } from "vitest";
import { pickSite } from "./pick-site";

const sites = [{ id: 1 }, { id: 2 }, { id: 3 }];
const counts = new Map([
  [2, 5],
  [3, 8],
]);

describe("pickSite", () => {
  it("網址有 ?site= 就用網址的", () => expect(pickSite(sites, counts, "3", "1")?.id).toBe(3));
  it("沒有 ?site= 時用上次選的收購點", () => expect(pickSite(sites, counts, undefined, "1")?.id).toBe(1));
  it("上次選的收購點已不存在或停用：改開第一個有資料的", () =>
    expect(pickSite(sites, counts, undefined, "99")?.id).toBe(2));
  it("網址的 ?site= 不存在：用上次選的", () => expect(pickSite(sites, counts, "99", "3")?.id).toBe(3));
  it("什麼都沒有：第一個有資料的，再沒有就第一個", () => {
    expect(pickSite(sites, counts, undefined)?.id).toBe(2);
    expect(pickSite(sites, new Map(), undefined)?.id).toBe(1);
    expect(pickSite([], counts, "1", "1")).toBeUndefined();
  });
});

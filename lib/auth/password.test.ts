import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("密碼雜湊", () => {
  it("正確密碼通過、錯誤密碼不通過", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("correct horsE", stored)).toBe(false);
  });

  it("同一個密碼每次雜湊結果不同（有 salt）", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("格式錯誤的雜湊一律不通過", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
  });
});

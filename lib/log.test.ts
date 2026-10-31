import { describe, expect, it, vi } from "vitest";
import { logError } from "./log";

describe("logError", () => {
  it("記錄資料庫錯誤訊息，不記 SQL 參數", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("Failed query: insert into `users` values (?, ?)\nparams: claude,pbkdf2$secret"), {
      params: ["claude", "pbkdf2$secret"],
      cause: new Error("Execute SQL fail: Error 1062 (23000): Duplicate entry '?' for key 'users.users_username'"),
    });
    logError("createUser", err);
    const logged = spy.mock.calls[0].join(" ");
    expect(logged).toContain("Duplicate entry");
    expect(logged).toContain("Failed query");
    expect(logged).not.toContain("pbkdf2$secret");
    spy.mockRestore();
  });
});

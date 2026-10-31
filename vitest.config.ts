import { defineConfig } from "vitest/config";

// 計算模組是純函式，不需要 vinext / Cloudflare 外掛
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});

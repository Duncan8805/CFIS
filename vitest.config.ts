import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 計算與匯入模組是純函式，不需要 vinext / Cloudflare 外掛
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});

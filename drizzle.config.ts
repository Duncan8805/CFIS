import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// 本機的 DATABASE_URL 放在 .dev.vars（跟 Worker 本機開發共用，已加入 .gitignore）
config({ path: ".dev.vars" });

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("請在 .dev.vars 設定 DATABASE_URL（TiDB Cloud 的連線字串）");
const url = new URL(raw);

export default defineConfig({
  dialect: "mysql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || 4000),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    // TiDB Cloud 要求 TLS（Node 預設最低就是 TLS 1.2）
    ssl: { rejectUnauthorized: true },
  },
});

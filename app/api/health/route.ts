import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { logError } from "@/lib/log";

// 部署後確認 Worker 連得到 TiDB；不回傳任何資料內容
export async function GET() {
  const started = Date.now();
  try {
    await getDb().execute(sql`SELECT 1`);
    return Response.json({ ok: true, db: "ok", ms: Date.now() - started });
  } catch (err) {
    logError("health check failed", err);
    return Response.json({ ok: false, db: "error" }, { status: 503 });
  }
}

import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/lib/db";

/** 正在看哪一期（切回舊期別時用）；沒有設定就是最新的一期 */
export const PERIOD_COOKIE = "cfis_period";

export type Period = typeof schema.periods.$inferSelect;

export async function listPeriods(): Promise<Period[]> {
  return getDb().select().from(schema.periods).orderBy(desc(schema.periods.rocYear), desc(schema.periods.term));
}

/** 目前作業中的期別：最新的一期 */
export async function getLatestPeriod(): Promise<Period> {
  const [period] = await listPeriods();
  if (!period) throw new Error("資料庫沒有任何期別");
  return period;
}

/** 正在看的期別：使用者從「目前期別」選單切換的那一期，沒切換過就是最新的一期 */
export async function getCurrentPeriod(): Promise<Period> {
  const id = Number((await cookies()).get(PERIOD_COOKIE)?.value);
  if (Number.isInteger(id) && id > 0) {
    const [period] = await getDb().select().from(schema.periods).where(eq(schema.periods.id, id)).limit(1);
    if (period) return period;
  }
  return getLatestPeriod();
}

/** 外框用：正在看的期別、作業中的期別、全部期別 */
export async function getPeriodContext() {
  const [periods, current] = await Promise.all([listPeriods(), getCurrentPeriod()]);
  const latest = periods[0] ?? current;
  return { periods, current, latest, isPast: current.id !== latest.id };
}

export const periodLabel = (p: { rocYear: number; term: number }) => `${p.rocYear} 年第 ${p.term} 期`;
export const periodShort = (p: { rocYear: number; term: number }) => `${p.rocYear}-${p.term}`;

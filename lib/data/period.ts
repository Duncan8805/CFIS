import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** 目前作業中的期別：最新的一期 */
export async function getCurrentPeriod() {
  const [period] = await getDb()
    .select()
    .from(schema.periods)
    .orderBy(desc(schema.periods.rocYear), desc(schema.periods.term))
    .limit(1);
  if (!period) throw new Error("資料庫沒有任何期別");
  return period;
}

export const periodLabel = (p: { rocYear: number; term: number }) => `${p.rocYear} 年第 ${p.term} 期`;

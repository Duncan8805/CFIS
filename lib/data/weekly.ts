import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { WeeklyRowDto } from "@/lib/weekly/fields";

const g = schema.grainRecords;
const w = schema.weeklyEntries;

export const weeklyColumns = {
  entryId: w.id,
  grainId: g.id,
  seq: g.seq,
  name: g.name,
  kg: g.kg,
  phone: g.phone,
  intakeDate: w.intakeDate,
  moisture: w.moisture,
  plannedSellDate: w.plannedSellDate,
  sellToOverride: w.sellToOverride,
  remarkOverride: w.remarkOverride,
};

/** 週報表的列：順序跟公糧相同，姓名與公斤從公糧帶入 */
export async function listWeeklyRows(periodId: number, siteId: number): Promise<WeeklyRowDto[]> {
  return getDb()
    .select(weeklyColumns)
    .from(w)
    .innerJoin(g, eq(w.grainRecordId, g.id))
    .where(and(eq(g.periodId, periodId), eq(g.siteId, siteId)))
    .orderBy(asc(g.seq), asc(g.id));
}

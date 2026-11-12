import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/lib/db";
import { SITE_COOKIE } from "./pick-site";

export { pickSite, SITE_COOKIE } from "./pick-site";

const s = schema.sites;
const g = schema.grainRecords;
const w = schema.weeklyEntries;

export type Site = typeof s.$inferSelect;

export async function listSites({ includeInactive = false } = {}): Promise<Site[]> {
  const q = getDb().select().from(s);
  return (includeInactive ? q : q.where(eq(s.active, true))).orderBy(asc(s.sortOrder), asc(s.id));
}

/** 每個收購點這一期週報表還沒填日期或水分的筆數（有姓名的才算） */
export async function weeklyPendingBySite(periodId: number): Promise<Map<number, number>> {
  const rows = await getDb()
    .select({ siteId: g.siteId, n: sql<number>`count(*)` })
    .from(w)
    .innerJoin(g, eq(w.grainRecordId, g.id))
    .where(and(eq(g.periodId, periodId), sql`${g.name} <> ''`, or(isNull(w.intakeDate), isNull(w.moisture))))
    .groupBy(g.siteId);
  return new Map(rows.map((r) => [r.siteId, Number(r.n)]));
}

/** 使用者上次選的收購點（收購點選單記在 cookie），網址沒有 ?site= 時用 */
export async function rememberedSite(): Promise<string | undefined> {
  return (await cookies()).get(SITE_COOKIE)?.value;
}

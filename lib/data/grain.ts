import { and, asc, desc, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { GrainRecordDto } from "@/lib/grain/fields";

const g = schema.grainRecords;

export const grainColumns = {
  id: g.id,
  seq: g.seq,
  code: g.code,
  name: g.name,
  phone: g.phone,
  address: g.address,
  kg: g.kg,
  fen: g.fen,
  deposit: g.deposit,
  collectOverride: g.collectOverride,
  roundingMode: g.roundingMode,
};

export async function listGrainRecords(periodId: number, siteId: number): Promise<GrainRecordDto[]> {
  return getDb()
    .select(grainColumns)
    .from(g)
    .where(and(eq(g.periodId, periodId), eq(g.siteId, siteId)))
    .orderBy(asc(g.seq), asc(g.id));
}

export async function countBySite(periodId: number): Promise<Map<number, number>> {
  const rows = await getDb()
    .select({ siteId: g.siteId, n: sql<number>`count(*)` })
    .from(g)
    .where(eq(g.periodId, periodId))
    .groupBy(g.siteId);
  return new Map(rows.map((r) => [r.siteId, Number(r.n)]));
}

export interface FarmerSuggestion {
  name: string;
  phone: string | null;
  address: string | null;
}

/** 打姓名時自動帶出電話、地址：取每個姓名最近一筆「有電話或地址」的紀錄 */
export async function farmerSuggestions(): Promise<FarmerSuggestion[]> {
  const rows = await getDb()
    .select({ name: g.name, phone: g.phone, address: g.address })
    .from(g)
    .where(and(ne(g.name, ""), or(isNotNull(g.phone), isNotNull(g.address))))
    .orderBy(desc(g.updatedAt))
    .limit(5000);
  const seen = new Map<string, FarmerSuggestion>();
  for (const r of rows) if (!seen.has(r.name)) seen.set(r.name, r);
  return [...seen.values()];
}

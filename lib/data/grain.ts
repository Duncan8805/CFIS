import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { GrainRecordDto } from "@/lib/grain/fields";

const g = schema.grainRecords;

export const grainColumns = {
  id: g.id,
  seq: g.seq,
  farmerId: g.farmerId,
  fileNo: g.fileNo,
  code: g.code,
  name: g.name,
  phone: g.phone,
  address: g.address,
  kg: g.kg,
  planKg: g.planKg,
  guideKg: g.guideKg,
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

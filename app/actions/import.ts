"use server";

import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import type { SiteConfig } from "@/lib/import/plan";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("只有管理員可以匯入資料");
  return user;
}

export interface ImportContext {
  periodLabel: string;
  sites: SiteConfig[];
  /** 各收購點本期已有的公糧筆數 */
  existing: Record<number, number>;
}

export async function getImportContext(): Promise<ImportContext> {
  await requireAdmin();
  const db = getDb();
  const period = await getCurrentPeriod();
  const sites = await db
    .select({
      id: schema.sites.id,
      name: schema.sites.name,
      weeklySheetName: schema.sites.weeklySheetName,
      sellTo: schema.sites.sellTo,
      remarkMode: schema.sites.remarkMode,
      agentContact: schema.sites.agentContact,
      roundingMode: schema.sites.roundingMode,
    })
    .from(schema.sites)
    .where(eq(schema.sites.active, true))
    .orderBy(asc(schema.sites.sortOrder));
  const counts = await db
    .select({ siteId: schema.grainRecords.siteId, n: count() })
    .from(schema.grainRecords)
    .where(eq(schema.grainRecords.periodId, period.id))
    .groupBy(schema.grainRecords.siteId);
  return {
    periodLabel: periodLabel(period),
    sites,
    existing: Object.fromEntries(counts.map((c) => [c.siteId, c.n])),
  };
}

const text = (max: number) => z.string().trim().max(max).nullable();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const SiteImportSchema = z.object({
  siteId: z.number().int().positive(),
  agentContact: text(100),
  records: z
    .array(
      z.object({
        seq: z.number().int().positive(),
        code: text(20),
        name: z.string().trim().min(1).max(32),
        phone: text(100),
        address: text(200),
        kg: z.number().int().min(0).max(10_000_000).nullable(),
        fen: z.number().min(0).max(9999).nullable(),
        deposit: z.number().int().min(-100_000_000).max(100_000_000).nullable(),
        collectOverride: text(20),
        weekly: z
          .object({
            intakeDate: isoDate,
            moisture: z.number().int().min(0).max(100).nullable(),
            plannedSellDate: isoDate,
            sellToOverride: text(32),
            remarkOverride: text(100),
          })
          .nullable(),
      }),
    )
    .max(2000),
});

export type SiteImportInput = z.infer<typeof SiteImportSchema>;

export interface SiteImportResult {
  ok: boolean;
  imported?: number;
  weekly?: number;
  error?: string;
}

/** 匯入一個收購點：刪掉本期該收購點的舊資料，整批寫入新資料（同一個 transaction） */
export async function importSite(input: SiteImportInput): Promise<SiteImportResult> {
  const user = await requireAdmin();
  const parsed = SiteImportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "資料格式不正確：" + parsed.error.issues[0]?.message };
  const { siteId, agentContact, records } = parsed.data;

  const db = getDb();
  const period = await getCurrentPeriod();
  const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, siteId)).limit(1);
  if (!site) return { ok: false, error: "找不到收購點" };

  try {
    const weeklyCount = await db.transaction(async (tx) => {
      const scope = and(eq(schema.grainRecords.periodId, period.id), eq(schema.grainRecords.siteId, siteId));
      await tx.delete(schema.grainRecords).where(scope); // weekly_entries 會跟著刪（ON DELETE CASCADE）

      if (records.length) {
        await tx.insert(schema.grainRecords).values(
          records.map((r) => ({
            periodId: period.id,
            siteId,
            seq: r.seq,
            code: r.code,
            name: r.name,
            phone: r.phone,
            address: r.address,
            kg: r.kg,
            fen: r.fen,
            deposit: r.deposit,
            collectOverride: r.collectOverride,
            updatedBy: user.id,
          })),
        );
      }

      const inserted = await tx
        .select({ id: schema.grainRecords.id, seq: schema.grainRecords.seq })
        .from(schema.grainRecords)
        .where(scope);
      const idBySeq = new Map(inserted.map((r) => [r.seq, r.id]));
      const weeklyValues = records
        .filter((r) => r.weekly)
        .map((r) => ({ grainRecordId: idBySeq.get(r.seq)!, ...r.weekly!, updatedBy: user.id }));
      if (weeklyValues.length) await tx.insert(schema.weeklyEntries).values(weeklyValues);

      if (site.remarkMode === "agent_contact" && agentContact && agentContact !== site.agentContact) {
        await tx.update(schema.sites).set({ agentContact }).where(eq(schema.sites.id, siteId));
      }

      await tx.insert(schema.auditLogs).values({
        userId: user.id,
        entity: "site_import",
        entityId: siteId,
        action: "create",
        changes: { period: periodLabel(period), records: records.length, weekly: weeklyValues.length },
      });
      return weeklyValues.length;
    });
    return { ok: true, imported: records.length, weekly: weeklyCount };
  } catch (err) {
    console.error("import failed", siteId, err);
    return { ok: false, error: "寫入資料庫失敗，這個收購點的資料沒有變動" };
  }
}

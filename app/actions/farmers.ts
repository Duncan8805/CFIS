"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { calcGrain, effectiveRoundingMode } from "@/lib/calc";
import { getCalcSettings } from "@/lib/data/settings";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { farmerHistory, type FarmerHistoryRow } from "@/lib/data/farmers";
import { getLatestPeriod } from "@/lib/data/period";
import { FILE_NO_PATTERN } from "@/lib/grain/fields";
import { logError } from "@/lib/log";
import type { ActionResult } from "./grain";

const f = schema.farmers;
const g = schema.grainRecords;

const FarmerSchema = z.object({
  fileNo: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => s === "" || FILE_NO_PATTERN.test(s), "檔號是 1 個英文字母加 8 位數字，例如 Q11101404")
    .transform((s) => s || null),
  name: z.string().trim().min(1, "請填姓名").max(32),
  phone: z
    .string()
    .trim()
    .max(100)
    .transform((s) => s || null),
  address: z
    .string()
    .trim()
    .max(200)
    .transform((s) => s || null),
});
export type FarmerInput = z.input<typeof FarmerSchema>;

function isDuplicate(err: unknown): boolean {
  for (let e = err as { message?: string; cause?: unknown } | undefined, depth = 0; e && depth < 5; depth++) {
    if (String(e.message ?? e).includes("Duplicate entry")) return true;
    e = e.cause as typeof e;
  }
  return false;
}

export async function createFarmer(input: FarmerInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireUser();
  const parsed = FarmerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料格式不正確" };
  try {
    const [{ id }] = await getDb().insert(f).values(parsed.data).$returningId();
    await getDb().insert(schema.auditLogs).values({ userId: user.id, entity: "farmer", entityId: id, action: "create", changes: parsed.data });
    revalidatePath("/farmers");
    return { ok: true, data: { id: Number(id) } };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: `檔號 ${parsed.data.fileNo} 已經在名冊裡了` };
    logError("createFarmer", err);
    return { ok: false, error: "新增失敗，請再試一次" };
  }
}

/** 作業中那一期有幾筆公糧紀錄用到這位農民（改電話時問要不要一起更新） */
export async function countCurrentRecords(farmerId: number): Promise<ActionResult<{ n: number; period: string; sites: string[] }>> {
  await requireUser();
  if (!Number.isInteger(farmerId)) return { ok: false, error: "資料格式不正確" };
  const latest = await getLatestPeriod();
  const rows = await getDb()
    .select({ site: schema.sites.name })
    .from(g)
    .innerJoin(schema.sites, eq(g.siteId, schema.sites.id))
    .where(and(eq(g.farmerId, farmerId), eq(g.periodId, latest.id)));
  return {
    ok: true,
    data: { n: rows.length, period: `${latest.rocYear} 年第 ${latest.term} 期`, sites: [...new Set(rows.map((r) => r.site))] },
  };
}

/**
 * 修改名冊上的農民。applyToCurrent = true 時，作業中那一期用到這位農民的公糧紀錄也一起改
 * （週報表備註、收款單會用新資料）；過去期別保留當時的值，因為收款單已經印出去了。
 */
export async function updateFarmer(
  id: number,
  input: FarmerInput,
  applyToCurrent: boolean,
): Promise<ActionResult<{ updatedRecords: number }>> {
  const user = await requireUser();
  const parsed = FarmerSchema.safeParse(input);
  if (!parsed.success || !Number.isInteger(id)) {
    return { ok: false, error: parsed.success ? "資料格式不正確" : (parsed.error.issues[0]?.message ?? "資料格式不正確") };
  }
  const db = getDb();
  try {
    const [before] = await db.select().from(f).where(eq(f.id, id)).limit(1);
    if (!before) return { ok: false, error: "找不到這位農民，可能已被刪除" };
    const changed = Object.fromEntries(
      Object.entries(parsed.data).filter(([k, v]) => before[k as keyof typeof before] !== v),
    ) as Partial<typeof parsed.data>;
    if (!Object.keys(changed).length) return { ok: true, data: { updatedRecords: 0 } };

    const latest = await getLatestPeriod();
    let updatedRecords = 0;
    await db.transaction(async (tx) => {
      await tx.update(f).set(changed).where(eq(f.id, id));
      if (applyToCurrent) {
        const scope = and(eq(g.farmerId, id), eq(g.periodId, latest.id));
        const [{ n }] = await tx.select({ n: count() }).from(g).where(scope);
        updatedRecords = n;
        if (n) await tx.update(g).set({ ...changed, updatedBy: user.id }).where(scope);
      }
      await tx.insert(schema.auditLogs).values({
        userId: user.id,
        entity: "farmer",
        entityId: id,
        action: "update",
        changes: {
          ...Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }])),
          appliedToRecords: updatedRecords,
        },
      });
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { updatedRecords } };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: `檔號 ${parsed.data.fileNo} 已經是名冊上另一位農民的` };
    logError("updateFarmer", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

export interface FarmerHistoryItem {
  recordId: number;
  period: string;
  site: string;
  kg: number | null;
  /** 收：計算值或手動文字（例如「扣」） */
  collect: string;
}

/** 某位農民歷期的繳穀紀錄；收 用各期自己的計算參數算 */
export async function getFarmerHistory(farmerId: number): Promise<ActionResult<FarmerHistoryItem[]>> {
  await requireUser();
  if (!Number.isInteger(farmerId)) return { ok: false, error: "資料格式不正確" };
  try {
    const rows: FarmerHistoryRow[] = await farmerHistory(farmerId);
    const periodIds = [...new Set(rows.map((r) => r.periodId))];
    const periods = periodIds.length
      ? await getDb().select().from(schema.periods).where(inArray(schema.periods.id, periodIds))
      : [];
    const settings = new Map(
      await Promise.all(periods.map(async (p) => [p.id, await getCalcSettings(p)] as const)),
    );
    return {
      ok: true,
      data: rows.map((r) => {
        const c = calcGrain(
          { kg: r.kg, fen: r.fen, deposit: r.deposit, collectOverride: r.collectOverride },
          settings.get(r.periodId)?.rates,
          effectiveRoundingMode(r.roundingMode, r.siteRoundingMode),
        );
        return {
          recordId: r.recordId,
          period: `${r.rocYear}-${r.term}`,
          site: r.site,
          kg: r.kg,
          collect: c.collectText ?? (r.deposit === null ? "" : (c.collect ?? 0).toLocaleString("zh-TW", { maximumFractionDigits: 2 })),
        };
      }),
    };
  } catch (err) {
    logError("getFarmerHistory", err);
    return { ok: false, error: "讀取繳穀紀錄失敗" };
  }
}

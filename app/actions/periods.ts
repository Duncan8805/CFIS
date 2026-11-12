"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { getCurrentPeriod, getLatestPeriod, periodLabel, PERIOD_COOKIE } from "@/lib/data/period";
import { getCalcSettings } from "@/lib/data/settings";
import { logError } from "@/lib/log";
import type { ActionResult } from "./grain";

async function rememberPeriod(id: number, latestId: number) {
  const store = await cookies();
  // 看最新一期時不用記，之後新增期別會自動切過去
  if (id === latestId) store.delete(PERIOD_COOKIE);
  else store.set(PERIOD_COOKIE, String(id), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}

/** 切換正在看的期別（每個人自己的，不影響別人） */
export async function switchPeriod(id: number): Promise<ActionResult<null>> {
  await requireUser();
  if (!Number.isInteger(id)) return { ok: false, error: "資料格式不正確" };
  const [period] = await getDb().select({ id: schema.periods.id }).from(schema.periods).where(eq(schema.periods.id, id)).limit(1);
  if (!period) return { ok: false, error: "找不到這個期別" };
  await rememberPeriod(id, (await getLatestPeriod()).id);
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

const NewPeriodSchema = z.object({
  rocYear: z.number().int().min(100, "年度要填民國年").max(200),
  term: z.union([z.literal(1), z.literal(2)]),
  interestPerFen: z.number().positive("每分利要大於 0").max(1_000_000),
  freightPerKg: z.number().min(0, "運費不能是負數").max(1000),
  planKgPerHa: z.number().int().min(0).max(100_000).nullable(),
  guideKgPerHa: z.number().int().min(0).max(100_000).nullable(),
});
export type NewPeriodInput = z.infer<typeof NewPeriodSchema>;

/** 這一期的計算參數（新增期別時預先帶入：從正在看的那一期複製） */
export async function getNewPeriodDefaults() {
  await requireAdmin();
  const latest = await getLatestPeriod();
  const settings = await getCalcSettings(latest);
  const next = latest.term === 1 ? { rocYear: latest.rocYear, term: 2 as const } : { rocYear: latest.rocYear + 1, term: 1 as const };
  return {
    from: periodLabel(latest),
    ...next,
    interestPerFen: settings.rates.interestPerFen,
    freightPerKg: settings.rates.freightPerKg,
    planKgPerHa: settings.planKgPerHa,
    guideKgPerHa: settings.guideKgPerHa,
    moistureCount: settings.moistureRates.length,
  };
}

/** 新增期別：計算參數存在新的一期，水分折算率從最新一期複製；建好後切換過去 */
export async function createPeriod(input: NewPeriodInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireAdmin();
  const parsed = NewPeriodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料格式不正確" };
  const d = parsed.data;
  const db = getDb();
  try {
    const [exists] = await db
      .select({ id: schema.periods.id })
      .from(schema.periods)
      .where(and(eq(schema.periods.rocYear, d.rocYear), eq(schema.periods.term, d.term)))
      .limit(1);
    if (exists) return { ok: false, error: `${periodLabel(d)}已經有了，可以從「目前期別」切過去` };

    const source = await getCalcSettings(await getLatestPeriod());
    const [{ id }] = await db
      .insert(schema.periods)
      .values({ ...d, moistureRates: source.moistureRates })
      .$returningId();
    await db.insert(schema.auditLogs).values({ userId: user.id, entity: "period", entityId: id, action: "create", changes: d });
    await rememberPeriod(Number(id), (await getLatestPeriod()).id);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: Number(id) } };
  } catch (err) {
    logError("createPeriod", err);
    return { ok: false, error: "建立失敗，請再試一次" };
  }
}

const CalcSchema = z.object({
  interestPerFen: z.number().positive("每分利要大於 0").max(1_000_000),
  freightPerKg: z.number().min(0, "運費不能是負數").max(1000),
  planKgPerHa: z.number().int().min(0).max(100_000).nullable(),
  guideKgPerHa: z.number().int().min(0).max(100_000).nullable(),
});

/** 改正在看的那一期的計算參數；其他期別不受影響 */
export async function savePeriodCalc(input: z.infer<typeof CalcSchema>): Promise<ActionResult<null>> {
  const user = await requireAdmin();
  const parsed = CalcSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料格式不正確" };
  const period = await getCurrentPeriod();
  try {
    await getDb().transaction(async (tx) => {
      await tx.update(schema.periods).set(parsed.data).where(eq(schema.periods.id, period.id));
      await tx
        .insert(schema.auditLogs)
        .values({ userId: user.id, entity: "period", entityId: period.id, action: "update", changes: parsed.data });
    });
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (err) {
    logError("savePeriodCalc", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

const MoistureSchema = z
  .array(
    z.object({
      moisture: z.number().int().min(0).max(100),
      rate: z.number().gt(0, "折算率要大於 0").max(1, "折算率不能大於 1"),
    }),
  )
  .min(1, "至少要有一列")
  .max(100)
  .refine((rows) => new Set(rows.map((r) => r.moisture)).size === rows.length, "水分有重複");

/** 整張水分折算率表一起取代（只改正在看的那一期） */
export async function savePeriodMoisture(rows: { moisture: number; rate: number }[]): Promise<ActionResult<null>> {
  const user = await requireAdmin();
  const parsed = MoistureSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "資料格式不正確" };
  const period = await getCurrentPeriod();
  const sorted = [...parsed.data].sort((a, b) => a.moisture - b.moisture);
  try {
    await getDb().transaction(async (tx) => {
      await tx.update(schema.periods).set({ moistureRates: sorted }).where(eq(schema.periods.id, period.id));
      await tx
        .insert(schema.auditLogs)
        .values({ userId: user.id, entity: "moisture_rates", entityId: period.id, action: "update", changes: sorted });
    });
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (err) {
    logError("savePeriodMoisture", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

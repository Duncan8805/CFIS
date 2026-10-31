"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { weeklyColumns } from "@/lib/data/weekly";
import type { WeeklyPatch, WeeklyRowDto } from "@/lib/weekly/fields";
import { logError } from "@/lib/log";
import type { ActionResult } from "./grain";

const w = schema.weeklyEntries;
const g = schema.grainRecords;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const PatchSchema = z
  .object({
    intakeDate: isoDate,
    moisture: z.number().int().min(0).max(100).nullable(),
    plannedSellDate: isoDate,
    sellToOverride: z.string().trim().max(32).nullable(),
    remarkOverride: z.string().trim().max(100).nullable(),
  })
  .partial()
  .strict();

async function fetchRow(entryId: number): Promise<WeeklyRowDto | null> {
  const [row] = await getDb()
    .select(weeklyColumns)
    .from(w)
    .innerJoin(g, eq(w.grainRecordId, g.id))
    .where(eq(w.id, entryId))
    .limit(1);
  return row ?? null;
}

export async function updateWeeklyEntry(entryId: number, input: WeeklyPatch): Promise<ActionResult<WeeklyRowDto>> {
  const user = await requireUser();
  const patch = PatchSchema.safeParse(input);
  if (!patch.success || !Number.isInteger(entryId)) return { ok: false, error: "資料格式不正確" };

  try {
    const before = await fetchRow(entryId);
    if (!before) return { ok: false, error: "找不到這筆資料，可能已被刪除" };
    const changes = Object.fromEntries(
      Object.entries(patch.data)
        .filter(([k, v]) => before[k as keyof WeeklyRowDto] !== v)
        .map(([k, v]) => [k, { from: before[k as keyof WeeklyRowDto], to: v }]),
    );
    if (!Object.keys(changes).length) return { ok: true, data: before };

    await getDb().transaction(async (tx) => {
      await tx.update(w).set({ ...patch.data, updatedBy: user.id }).where(eq(w.id, entryId));
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "weekly_entry", entityId: entryId, action: "update", changes });
    });
    const after = await fetchRow(entryId);
    return after ? { ok: true, data: after } : { ok: false, error: "儲存後讀不到資料" };
  } catch (err) {
    logError("updateWeeklyEntry", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

const MoistureSchema = z
  .array(z.object({ entryId: z.number().int().positive(), moisture: z.number().int().min(0).max(100) }))
  .min(1)
  .max(2000);

/** 一次寫入多筆水分（隨機產生水分用） */
export async function setMoistures(
  items: { entryId: number; moisture: number }[],
): Promise<ActionResult<{ entryId: number; moisture: number }[]>> {
  const user = await requireUser();
  const parsed = MoistureSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "資料格式不正確" };

  try {
    await getDb().transaction(async (tx) => {
      // 依水分值分組，每組一個 UPDATE，避免逐筆往返資料庫
      const byValue = new Map<number, number[]>();
      for (const { entryId, moisture } of parsed.data) byValue.set(moisture, [...(byValue.get(moisture) ?? []), entryId]);
      for (const [moisture, ids] of byValue) {
        await tx.update(w).set({ moisture, updatedBy: user.id }).where(inArray(w.id, ids));
      }
      await tx.insert(schema.auditLogs).values({
        userId: user.id,
        entity: "weekly_moisture",
        entityId: parsed.data[0].entryId,
        action: "update",
        changes: { random: parsed.data },
      });
    });
    return { ok: true, data: parsed.data };
  } catch (err) {
    logError("setMoistures", err);
    return { ok: false, error: "水分寫入失敗，資料沒有變動" };
  }
}

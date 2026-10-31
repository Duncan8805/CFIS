"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getCurrentPeriod } from "@/lib/data/period";
import { grainColumns } from "@/lib/data/grain";
import type { GrainPatch, GrainRecordDto } from "@/lib/grain/fields";

const g = schema.grainRecords;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const text = (max: number) => z.string().trim().max(max).nullable();
const PatchSchema = z
  .object({
    code: text(20),
    name: z.string().trim().max(32),
    phone: text(100),
    address: text(200),
    kg: z.number().int().min(0).max(10_000_000).nullable(),
    fen: z.number().min(0).max(9999).nullable(),
    deposit: z.number().int().min(-100_000_000).max(100_000_000).nullable(),
    collectOverride: text(20),
  })
  .partial()
  .strict();

async function fetchRecord(id: number): Promise<GrainRecordDto | null> {
  const [row] = await getDb().select(grainColumns).from(g).where(eq(g.id, id)).limit(1);
  return row ?? null;
}

/** 新增一筆（排在最後），週報表同時建立對應的一筆 */
export async function createGrainRecord(siteId: number, initial: GrainPatch = {}): Promise<ActionResult<GrainRecordDto>> {
  const user = await requireUser();
  const patch = PatchSchema.safeParse(initial);
  if (!patch.success || !Number.isInteger(siteId)) return { ok: false, error: "資料格式不正確" };
  const period = await getCurrentPeriod();
  const db = getDb();

  try {
    const id = await db.transaction(async (tx) => {
      const [{ maxSeq }] = await tx
        .select({ maxSeq: sql<number>`coalesce(max(${g.seq}), 0)` })
        .from(g)
        .where(and(eq(g.periodId, period.id), eq(g.siteId, siteId)));
      const [{ id: newId }] = await tx
        .insert(g)
        .values({
          periodId: period.id,
          siteId,
          seq: Number(maxSeq) + 1,
          name: "",
          ...patch.data,
          updatedBy: user.id,
        })
        .$returningId();
      await tx.insert(schema.weeklyEntries).values({ grainRecordId: newId, updatedBy: user.id });
      await tx.insert(schema.auditLogs).values({
        userId: user.id,
        entity: "grain_record",
        entityId: newId,
        action: "create",
        changes: patch.data,
      });
      return newId;
    });
    const record = await fetchRecord(id);
    return record ? { ok: true, data: record } : { ok: false, error: "新增後讀不到資料" };
  } catch (err) {
    console.error("createGrainRecord", err);
    return { ok: false, error: "新增失敗，請再試一次" };
  }
}

/** 修改一筆的部分欄位；修改紀錄存「改之前 → 改之後」 */
export async function updateGrainRecord(id: number, input: GrainPatch): Promise<ActionResult<GrainRecordDto>> {
  const user = await requireUser();
  const patch = PatchSchema.safeParse(input);
  if (!patch.success || !Number.isInteger(id)) return { ok: false, error: "資料格式不正確" };
  if (!Object.keys(patch.data).length) {
    const record = await fetchRecord(id);
    return record ? { ok: true, data: record } : { ok: false, error: "找不到這筆資料" };
  }

  const db = getDb();
  try {
    const before = await fetchRecord(id);
    if (!before) return { ok: false, error: "找不到這筆資料，可能已被刪除" };
    const changes = Object.fromEntries(
      Object.entries(patch.data)
        .filter(([k, v]) => before[k as keyof GrainRecordDto] !== v)
        .map(([k, v]) => [k, { from: before[k as keyof GrainRecordDto], to: v }]),
    );
    if (!Object.keys(changes).length) return { ok: true, data: before };

    await db.transaction(async (tx) => {
      await tx.update(g).set({ ...patch.data, updatedBy: user.id }).where(eq(g.id, id));
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "grain_record", entityId: id, action: "update", changes });
    });
    const after = await fetchRecord(id);
    return after ? { ok: true, data: after } : { ok: false, error: "儲存後讀不到資料" };
  } catch (err) {
    console.error("updateGrainRecord", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

/** 刪除一筆；週報表那一筆會跟著刪除 */
export async function deleteGrainRecord(id: number): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!Number.isInteger(id)) return { ok: false, error: "資料格式不正確" };
  const db = getDb();
  try {
    const before = await fetchRecord(id);
    if (!before) return { ok: true, data: null };
    await db.transaction(async (tx) => {
      await tx.delete(g).where(eq(g.id, id));
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "grain_record", entityId: id, action: "delete", changes: before });
    });
    return { ok: true, data: null };
  } catch (err) {
    console.error("deleteGrainRecord", err);
    return { ok: false, error: "刪除失敗，請再試一次" };
  }
}

"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getCurrentPeriod } from "@/lib/data/period";
import { grainColumns } from "@/lib/data/grain";
import { resolveFarmer } from "@/lib/data/farmers";
import { logError } from "@/lib/log";
import { FILE_NO_PATTERN, totalKg, type GrainPatch, type GrainRecordDto } from "@/lib/grain/fields";

const g = schema.grainRecords;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const text = (max: number) => z.string().trim().max(max).nullable();
const kgSchema = z.number().int().min(0).max(10_000_000).nullable();
const PatchSchema = z
  .object({
    fileNo: z.string().regex(FILE_NO_PATTERN).nullable(),
    code: text(20),
    name: z.string().trim().max(32),
    phone: text(100),
    address: text(200),
    planKg: kgSchema,
    guideKg: kgSchema,
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

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * 存檔前補上衍生的欄位：
 * - 公斤 = 計畫 + 輔導（兩欄都空白時保留原本的公斤）
 * - 檔號、姓名改了 → 重新對應農民名冊（名冊沒有的檔號自動加進去）
 */
async function withDerived(tx: Tx, before: GrainRecordDto | null, patch: GrainPatch) {
  const merged = { ...(before ?? emptyRecord), ...patch };
  const values: GrainPatch & { kg?: number | null; farmerId?: number | null } = { ...patch };
  if ("planKg" in patch || "guideKg" in patch) values.kg = totalKg(merged.planKg, merged.guideKg, before?.kg ?? null);
  // 電話、地址也要：名冊上還空著的欄位用這一筆補上（不會蓋掉名冊已經有的）
  if ("fileNo" in patch || "name" in patch || "phone" in patch || "address" in patch || !before) {
    // 檔號換了，原本連到的農民就不一定對；讓 resolveFarmer 依新檔號重新找
    const farmerId = "fileNo" in patch && before?.fileNo && before.fileNo !== patch.fileNo ? null : merged.farmerId;
    values.farmerId = await resolveFarmer(tx, { ...merged, farmerId });
  }
  return values;
}

const emptyRecord: GrainRecordDto = {
  id: 0, seq: 0, farmerId: null, fileNo: null, code: null, name: "", phone: null, address: null,
  kg: null, planKg: null, guideKg: null, fen: null, deposit: null, collectOverride: null, roundingMode: null,
};

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
          ...(await withDerived(tx, null, patch.data)),
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
    logError("createGrainRecord", err);
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
      const values = await withDerived(tx, before, patch.data);
      await tx.update(g).set({ ...values, updatedBy: user.id }).where(eq(g.id, id));
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "grain_record", entityId: id, action: "update", changes });
    });
    const after = await fetchRecord(id);
    return after ? { ok: true, data: after } : { ok: false, error: "儲存後讀不到資料" };
  } catch (err) {
    logError("updateGrainRecord", err);
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
    logError("deleteGrainRecord", err);
    return { ok: false, error: "刪除失敗，請再試一次" };
  }
}

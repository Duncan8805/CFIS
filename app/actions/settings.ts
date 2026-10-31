"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { requireAdmin, type CurrentUser } from "@/lib/auth/session";
import { SETTING_KEYS } from "@/lib/data/settings";
import { logError } from "@/lib/log";
import type { ActionResult } from "./grain";

// 設定頁的所有修改：只有管理員能做，每一次都留修改紀錄

type Ok = ActionResult<null>;
const ok: Ok = { ok: true, data: null };

async function audit(user: CurrentUser, entity: string, entityId: number, action: "create" | "update" | "delete", changes: unknown) {
  await getDb().insert(schema.auditLogs).values({ userId: user.id, entity, entityId, action, changes });
}

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "資料格式不正確";
}

/** MySQL / TiDB 的重複鍵錯誤（Drizzle 會把原始錯誤包在 cause 裡） */
function isDuplicate(err: unknown): boolean {
  for (let e = err as { message?: string; cause?: unknown } | undefined, depth = 0; e && depth < 5; depth++) {
    if (String(e.message ?? e).includes("Duplicate entry")) return true;
    e = e.cause as typeof e;
  }
  return false;
}

// ---------- 收購點 ----------

const SiteSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "請填收購點名稱").max(32),
  weeklySheetName: z.string().trim().min(1, "請填週報表名稱").max(32),
  sellTo: z.string().trim().min(1, "請填繳售業者").max(32),
  remarkMode: z.enum(["farmer_phone", "agent_contact"]),
  agentContact: z.string().trim().max(100).nullable(),
  roundingMode: z.enum(["truncate", "none"]),
  sortOrder: z.number().int().min(0).max(100000),
  active: z.boolean(),
});
export type SiteInput = z.infer<typeof SiteSchema>;

export async function saveSite(input: SiteInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireAdmin();
  const parsed = SiteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, ...data } = parsed.data;
  const values = { ...data, agentContact: data.agentContact || null };
  const db = getDb();
  try {
    if (id) {
      await db.update(schema.sites).set(values).where(eq(schema.sites.id, id));
      await audit(user, "site", id, "update", values);
      revalidatePath("/", "layout");
      return { ok: true, data: { id } };
    }
    const [{ id: newId }] = await db.insert(schema.sites).values(values).$returningId();
    await audit(user, "site", newId, "create", values);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: newId } };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: `已經有叫「${values.name}」的收購點` };
    logError("saveSite", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

// ---------- 計算參數 ----------

const CalcSchema = z.object({
  interestPerFen: z.number().positive("每分利要大於 0").max(1_000_000),
  freightPerKg: z.number().min(0, "運費不能是負數").max(1000),
  vendorName: z.string().trim().min(1, "請填繳交業者").max(32),
});

export async function saveCalcSettings(input: z.infer<typeof CalcSchema>): Promise<Ok> {
  const user = await requireAdmin();
  const parsed = CalcSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    await getDb().transaction(async (tx) => {
      for (const [key, value] of [
        [SETTING_KEYS.interestPerFen, d.interestPerFen],
        [SETTING_KEYS.freightPerKg, d.freightPerKg],
        [SETTING_KEYS.vendorName, d.vendorName],
      ] as const) {
        await tx.insert(schema.settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
      }
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "settings", entityId: 0, action: "update", changes: d });
    });
    revalidatePath("/", "layout");
    return ok;
  } catch (err) {
    logError("saveCalcSettings", err);
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

/** 整張水分折算率表一起取代 */
export async function saveMoistureRates(rows: { moisture: number; rate: number }[]): Promise<Ok> {
  const user = await requireAdmin();
  const parsed = MoistureSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await getDb().transaction(async (tx) => {
      await tx.delete(schema.moistureRates);
      await tx.insert(schema.moistureRates).values(parsed.data);
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "moisture_rates", entityId: 0, action: "update", changes: parsed.data });
    });
    revalidatePath("/", "layout");
    return ok;
  } catch (err) {
    logError("saveMoistureRates", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

// ---------- 農會帳號 ----------

const AccountSchema = z.object({
  id: z.number().int().positive().optional(),
  org: z.string().trim().min(1, "請填農會名稱").max(64),
  unitCode: z.string().trim().min(1, "請填單位代號").max(16),
  accountNo: z.string().trim().min(1, "請填帳號").max(32),
  holder: z.string().trim().min(1, "請填戶名").max(32),
  sortOrder: z.number().int().min(0).max(100000),
  active: z.boolean(),
});
export type AccountInput = z.infer<typeof AccountSchema>;

export async function saveBankAccount(input: AccountInput): Promise<ActionResult<{ id: number }>> {
  const user = await requireAdmin();
  const parsed = AccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, ...values } = parsed.data;
  const db = getDb();
  try {
    if (id) {
      await db.update(schema.bankAccounts).set(values).where(eq(schema.bankAccounts.id, id));
      await audit(user, "bank_account", id, "update", values);
      revalidatePath("/", "layout");
      return { ok: true, data: { id } };
    }
    const [{ id: newId }] = await db.insert(schema.bankAccounts).values(values).$returningId();
    await audit(user, "bank_account", newId, "create", values);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: newId } };
  } catch (err) {
    logError("saveBankAccount", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

// ---------- 使用者 ----------

const NewUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "帳號至少 2 個字")
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "帳號只能用英文、數字和 . _ -"),
  displayName: z.string().trim().min(1, "請填名稱").max(64),
  role: z.enum(["admin", "staff"]),
  password: z.string().min(MIN_PASSWORD_LENGTH, `密碼至少 ${MIN_PASSWORD_LENGTH} 個字元`).max(200),
});

export async function createUser(input: z.infer<typeof NewUserSchema>): Promise<Ok> {
  const user = await requireAdmin();
  const parsed = NewUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { password, ...rest } = parsed.data;
  try {
    const [{ id }] = await getDb()
      .insert(schema.users)
      .values({ ...rest, passwordHash: await hashPassword(password) })
      .$returningId();
    await audit(user, "user", id, "create", rest);
    revalidatePath("/settings");
    return ok;
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: `帳號「${rest.username}」已經有人用了` };
    logError("createUser", err);
    return { ok: false, error: "建立失敗，請再試一次" };
  }
}

const UpdateUserSchema = z.object({
  id: z.number().int().positive(),
  displayName: z.string().trim().min(1, "請填名稱").max(64),
  role: z.enum(["admin", "staff"]),
  active: z.boolean(),
});

/** 改名稱、權限、停用。不能停用或降級自己，也要保留至少一位管理員。停用後立刻登出。 */
export async function updateUser(input: z.infer<typeof UpdateUserSchema>): Promise<Ok> {
  const user = await requireAdmin();
  const parsed = UpdateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.id === user.id && (!d.active || d.role !== "admin")) {
    return { ok: false, error: "不能停用自己或取消自己的管理員權限" };
  }
  const db = getDb();
  try {
    if (!d.active || d.role !== "admin") {
      const [{ n }] = await db
        .select({ n: count() })
        .from(schema.users)
        .where(and(eq(schema.users.role, "admin"), eq(schema.users.active, true), ne(schema.users.id, d.id)));
      if (n === 0) return { ok: false, error: "至少要保留一位可以登入的管理員" };
    }
    await db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ displayName: d.displayName, role: d.role, active: d.active })
        .where(eq(schema.users.id, d.id));
      if (!d.active) await tx.delete(schema.sessions).where(eq(schema.sessions.userId, d.id));
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "user", entityId: d.id, action: "update", changes: d });
    });
    revalidatePath("/settings");
    return ok;
  } catch (err) {
    logError("updateUser", err);
    return { ok: false, error: "儲存失敗，請再試一次" };
  }
}

const ResetSchema = z.object({
  id: z.number().int().positive(),
  password: z.string().min(MIN_PASSWORD_LENGTH, `密碼至少 ${MIN_PASSWORD_LENGTH} 個字元`).max(200),
});

/** 重設密碼；這個帳號在其他裝置的登入會被登出 */
export async function resetPassword(input: z.infer<typeof ResetSchema>): Promise<Ok> {
  const user = await requireAdmin();
  const parsed = ResetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  try {
    await getDb().transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ passwordHash: await hashPassword(parsed.data.password) })
        .where(eq(schema.users.id, parsed.data.id));
      if (parsed.data.id !== user.id) await tx.delete(schema.sessions).where(eq(schema.sessions.userId, parsed.data.id));
      await tx.insert(schema.auditLogs).values({ userId: user.id, entity: "user", entityId: parsed.data.id, action: "update", changes: { password: "reset" } });
    });
    return ok;
  } catch (err) {
    logError("resetPassword", err);
    return { ok: false, error: "重設失敗，請再試一次" };
  }
}

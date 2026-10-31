"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

export interface LoginState {
  error: string | null;
  /** 登入失敗時保留帳號，表單重設後不用重打 */
  username?: string;
}

/** 只允許站內路徑，避免登入後被導到外部網站 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "請輸入帳號和密碼", username };

  const [user] = await getDb()
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash, active: schema.users.active })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  // 帳號不存在時也算一次雜湊，讓回應時間一致
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!user || !ok || !user.active) return { error: "帳號或密碼錯誤", username };

  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { getNewPeriodDefaults } from "@/app/actions/periods";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { NewPeriodForm } from "./new-period-form";

export const metadata: Metadata = { title: "新增期別" };

export default async function NewPeriodPage() {
  const user = await requireUser();
  if (user.role !== "admin") {
    return <PageHeader title="新增期別" description="只有管理員可以新增期別，需要時請找管理員。" />;
  }
  const db = getDb();
  const [defaults, [sites], [farmers], [accounts]] = await Promise.all([
    getNewPeriodDefaults(),
    db.select({ n: count() }).from(schema.sites).where(eq(schema.sites.active, true)),
    db.select({ n: count() }).from(schema.farmers),
    db.select({ n: count() }).from(schema.bankAccounts).where(eq(schema.bankAccounts.active, true)),
  ]);
  return <NewPeriodForm defaults={defaults} shared={{ sites: sites.n, farmers: farmers.n, accounts: accounts.n }} />;
}

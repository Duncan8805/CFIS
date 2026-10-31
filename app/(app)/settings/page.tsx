import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getCalcSettings } from "@/lib/data/settings";
import { SettingsAccounts } from "./settings-accounts";
import { SettingsCalc } from "./settings-calc";
import { SettingsSites } from "./settings-sites";
import { SettingsUsers } from "./settings-users";

export const metadata: Metadata = { title: "設定" };

const SECTIONS = [
  { id: "sites", label: "收購點" },
  { id: "calc", label: "計算參數" },
  { id: "accounts", label: "農會帳號" },
  { id: "users", label: "使用者" },
];

export default async function SettingsPage() {
  const user = await requireUser();
  if (user.role !== "admin") {
    return (
      <>
        <PageHeader title="設定" />
        <p className="rounded-xl border border-black/10 bg-white p-5 text-sm text-black/60">
          只有管理員可以修改設定。需要調整收購點、計算參數或帳號時，請找管理員。
        </p>
      </>
    );
  }

  const db = getDb();
  const [sites, settings, accounts, users] = await Promise.all([
    db
      .select({
        id: schema.sites.id,
        name: schema.sites.name,
        weeklySheetName: schema.sites.weeklySheetName,
        sellTo: schema.sites.sellTo,
        remarkMode: schema.sites.remarkMode,
        agentContact: schema.sites.agentContact,
        roundingMode: schema.sites.roundingMode,
        sortOrder: schema.sites.sortOrder,
        active: schema.sites.active,
      })
      .from(schema.sites)
      .orderBy(asc(schema.sites.sortOrder), asc(schema.sites.id)),
    getCalcSettings(),
    db
      .select({
        id: schema.bankAccounts.id,
        org: schema.bankAccounts.org,
        unitCode: schema.bankAccounts.unitCode,
        accountNo: schema.bankAccounts.accountNo,
        holder: schema.bankAccounts.holder,
        sortOrder: schema.bankAccounts.sortOrder,
        active: schema.bankAccounts.active,
      })
      .from(schema.bankAccounts)
      .orderBy(asc(schema.bankAccounts.sortOrder), asc(schema.bankAccounts.id)),
    db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        role: schema.users.role,
        active: schema.users.active,
      })
      .from(schema.users)
      .orderBy(asc(schema.users.id)),
  ]);

  return (
    <>
      <PageHeader title="設定" description="只有管理員看得到這一頁；每次修改都會記在修改紀錄裡" />
      <nav aria-label="設定項目" className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-1.5 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-full border border-black/15 bg-white px-3 py-1.5 hover:border-brand-500">
                {s.label}
              </a>
            </li>
          ))}
          <li>
            <Link href="/import" className="block rounded-full border border-black/15 bg-white px-3 py-1.5 hover:border-brand-500">
              匯入 Excel →
            </Link>
          </li>
        </ul>
      </nav>
      <div className="flex flex-col gap-5">
        <SettingsSites sites={sites} />
        <SettingsCalc settings={settings} />
        <SettingsAccounts accounts={accounts} />
        <SettingsUsers users={users} currentUserId={user.id} />
      </div>
    </>
  );
}

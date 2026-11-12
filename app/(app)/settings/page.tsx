import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getCalcSettings } from "@/lib/data/settings";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { listSites } from "@/lib/data/sites";
import { SettingsAccounts } from "./settings-accounts";
import { SettingsCalc } from "./settings-calc";
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
        <p className="rounded-[4px] border border-line bg-white p-5 text-[15px] text-muted">
          只有管理員可以修改設定。需要調整收購點、計算參數或帳號時，請找管理員。
        </p>
      </>
    );
  }

  const db = getDb();
  const period = await getCurrentPeriod();
  const [sites, settings, accounts, users] = await Promise.all([
    listSites({ includeInactive: true }),
    getCalcSettings(period),
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
      <nav aria-label="設定項目" className="mb-4">
        <ul className="flex flex-wrap gap-1.5 text-[15px]">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex min-h-11 items-center rounded-[4px] border border-field bg-white px-3.5 text-ink hover:border-brand-600 hover:text-brand-700">
                {s.label}
              </a>
            </li>
          ))}
          <li>
            <Link href="/import" className="flex min-h-11 items-center rounded-[4px] border border-field bg-white px-3.5 text-ink hover:border-brand-600 hover:text-brand-700">
              匯入 Excel →
            </Link>
          </li>
        </ul>
      </nav>
      <div className="flex flex-col gap-4">
        <section id="sites" className="flex flex-wrap items-center gap-3 rounded-[4px] border border-line bg-white p-4">
          <div className="min-w-60 flex-1">
            <h2 className="text-[16px] font-bold">收購點</h2>
            <p className="mt-1 text-[15px] text-muted">
              {sites.filter((s) => s.active).length} 個使用中
              {sites.some((s) => !s.active) && `、${sites.filter((s) => !s.active).length} 個停用`}
              。新增、修改週報表名稱、備註規則、捨入方式，或停用、刪除收購點。
            </p>
          </div>
          <Link href="/settings/sites" className="inline-flex min-h-11 items-center rounded-[4px] border border-field bg-white px-4 text-[15px] font-bold text-brand-700 hover:border-brand-600">
            管理收購點 →
          </Link>
        </section>
        <SettingsCalc settings={settings} periodLabel={periodLabel(period)} />
        <SettingsAccounts accounts={accounts} />
        <SettingsUsers users={users} currentUserId={user.id} />
      </div>
    </>
  );
}

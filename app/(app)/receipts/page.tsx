import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { SitePicker } from "@/components/site-picker";
import { calcGrain, effectiveRoundingMode } from "@/lib/calc";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { countBySite, listGrainRecords } from "@/lib/data/grain";
import { getCalcSettings } from "@/lib/data/settings";
import { listSites, pickSite } from "@/lib/data/sites";
import { ReceiptsClient } from "./receipts-client";
import type { ReceiptData } from "./receipt-slip";

export const metadata: Metadata = { title: "收款單" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const db = getDb();
  const [user, period, sites] = await Promise.all([requireUser(), getCurrentPeriod(), listSites()]);
  const counts = await countBySite(period.id);
  const site = pickSite(sites, counts, (await searchParams).site);
  if (!site) return <PageHeader title="收款單" description="還沒有任何收購點，請先到「設定 → 收購點」新增。" />;
  const [records, settings, accounts] = await Promise.all([
    listGrainRecords(period.id, site.id),
    getCalcSettings(period),
    db
      .select({
        id: schema.bankAccounts.id,
        org: schema.bankAccounts.org,
        unitCode: schema.bankAccounts.unitCode,
        accountNo: schema.bankAccounts.accountNo,
        holder: schema.bankAccounts.holder,
      })
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.active, true))
      .orderBy(asc(schema.bankAccounts.sortOrder)),
  ]);

  // 金額跟公糧頁用同一套計算（含逐筆捨入方式）
  const receipts: ReceiptData[] = records
    .filter((r) => r.name.trim())
    .map((r) => {
      const c = calcGrain(
        { kg: r.kg, fen: r.fen, deposit: r.deposit, collectOverride: r.collectOverride },
        settings.rates,
        effectiveRoundingMode(r.roundingMode, site.roundingMode),
      );
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        address: r.address,
        deposit: r.deposit,
        prepaid: c.prepaid,
        collect: c.collect,
        collectText: c.collectText,
        interest: c.interest,
        freight: c.freight,
      };
    });

  return (
    <SitePicker
      basePath="/receipts"
      sites={sites.map((s) => ({ id: s.id, label: s.name, count: counts.get(s.id) ?? 0 }))}
      activeId={site.id}
      canManage={user.role === "admin"}
    >
      <div className="print:hidden">
        <PageHeader eyebrow="收款單" title={site.name} description={`${periodLabel(period)}・A4 一頁 6 張，跟原本的收款單產生器同一個版面`} />
      </div>
      <ReceiptsClient key={`${period.id}-${site.id}`} siteName={site.name} receipts={receipts} accounts={accounts} />
    </SitePicker>
  );
}

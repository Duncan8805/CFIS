import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { SiteTabs } from "@/components/site-tabs";
import { calcGrain, effectiveRoundingMode } from "@/lib/calc";
import { getDb, schema } from "@/lib/db";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { countBySite, listGrainRecords } from "@/lib/data/grain";
import { ReceiptsClient } from "./receipts-client";
import type { ReceiptData } from "./receipt-slip";

export const metadata: Metadata = { title: "收款單" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const db = getDb();
  const period = await getCurrentPeriod();
  const sites = await db
    .select({ id: schema.sites.id, name: schema.sites.name, roundingMode: schema.sites.roundingMode })
    .from(schema.sites)
    .where(eq(schema.sites.active, true))
    .orderBy(asc(schema.sites.sortOrder));
  const counts = await countBySite(period.id);

  const { site: siteParam } = await searchParams;
  const site = sites.find((s) => String(s.id) === siteParam) ?? sites.find((s) => counts.get(s.id)) ?? sites[0];
  const [records, accounts] = await Promise.all([
    listGrainRecords(period.id, site.id),
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
        undefined,
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
    <>
      <div className="print:hidden">
        <PageHeader title="收款單" description={`${periodLabel(period)}・A4 一頁 6 張`} />
      </div>
      <SiteTabs
        basePath="/receipts"
        sites={sites.map((s) => ({ id: s.id, label: s.name }))}
        activeId={site.id}
        counts={counts}
      />
      <ReceiptsClient key={site.id} siteName={site.name} receipts={receipts} accounts={accounts} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { countBySite } from "@/lib/data/grain";
import { getCurrentPeriod } from "@/lib/data/period";
import { listSites } from "@/lib/data/sites";
import { SitesManager } from "../settings-sites";

export const metadata: Metadata = { title: "收購點" };

export default async function SitesPage({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string }> }) {
  const user = await requireUser();
  if (user.role !== "admin") {
    return <PageHeader title="收購點" description="只有管理員可以新增或修改收購點，需要調整時請找管理員。" />;
  }
  const period = await getCurrentPeriod();
  const [sites, current, all] = await Promise.all([
    listSites({ includeInactive: true }),
    countBySite(period.id),
    getDb()
      .select({ siteId: schema.grainRecords.siteId, n: count() })
      .from(schema.grainRecords)
      .groupBy(schema.grainRecords.siteId),
  ]);
  const totals = new Map(all.map((r) => [r.siteId, r.n]));
  const params = await searchParams;

  return (
    <>
      <div className="mb-1 text-[15px] text-muted">
        <Link href="/settings" className="inline-flex min-h-11 items-center text-brand-600 underline-offset-4 hover:underline">
          設定
        </Link>{" "}
        ／ 收購點
      </div>
      <SitesManager
        sites={sites.map((s) => ({
          id: s.id,
          name: s.name,
          weeklySheetName: s.weeklySheetName,
          sellTo: s.sellTo,
          remarkMode: s.remarkMode,
          agentContact: s.agentContact,
          roundingMode: s.roundingMode,
          sortOrder: s.sortOrder,
          active: s.active,
          currentCount: current.get(s.id) ?? 0,
          totalCount: totals.get(s.id) ?? 0,
        }))}
        startNew={params.new === "1"}
        startEditId={Number(params.edit) || null}
      />
    </>
  );
}

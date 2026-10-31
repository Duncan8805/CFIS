import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { SiteTabs } from "@/components/site-tabs";
import { getDb, schema } from "@/lib/db";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { countBySite, farmerSuggestions, listGrainRecords } from "@/lib/data/grain";
import { GrainSheet } from "./grain-sheet";

export const metadata: Metadata = { title: "公糧" };

export default async function GrainPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const period = await getCurrentPeriod();
  const sites = await getDb()
    .select({ id: schema.sites.id, name: schema.sites.name, roundingMode: schema.sites.roundingMode })
    .from(schema.sites)
    .where(eq(schema.sites.active, true))
    .orderBy(asc(schema.sites.sortOrder));
  const counts = await countBySite(period.id);

  // 沒指定收購點時，打開第一個有資料的
  const { site: siteParam } = await searchParams;
  const site = sites.find((s) => String(s.id) === siteParam) ?? sites.find((s) => counts.get(s.id)) ?? sites[0];
  const [records, suggestions] = await Promise.all([listGrainRecords(period.id, site.id), farmerSuggestions()]);

  return (
    <>
      <PageHeader
        title="公糧"
        description={`${periodLabel(period)}・輸入後自動帶入週報表`}
        actions={
          <Link href="/import" className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm hover:border-brand-500">
            匯入 Excel
          </Link>
        }
      />
      <SiteTabs
        basePath="/grain"
        sites={sites.map((s) => ({ id: s.id, label: s.name }))}
        activeId={site.id}
        counts={counts}
      />
      <GrainSheet key={site.id} site={site} initialRecords={records} suggestions={suggestions} />
    </>
  );
}

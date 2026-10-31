import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { SiteTabs } from "@/components/site-tabs";
import { getDb, schema } from "@/lib/db";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { countBySite } from "@/lib/data/grain";
import { listWeeklyRows } from "@/lib/data/weekly";
import { WeeklySheet } from "./weekly-sheet";

export const metadata: Metadata = { title: "週報表" };

async function vendorName(): Promise<string> {
  const [row] = await getDb()
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, "report.vendorName"))
    .limit(1);
  return typeof row?.value === "string" ? row.value : "長富";
}

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const period = await getCurrentPeriod();
  const sites = await getDb()
    .select({
      id: schema.sites.id,
      name: schema.sites.name,
      weeklySheetName: schema.sites.weeklySheetName,
      sellTo: schema.sites.sellTo,
      remarkMode: schema.sites.remarkMode,
      agentContact: schema.sites.agentContact,
    })
    .from(schema.sites)
    .where(eq(schema.sites.active, true))
    .orderBy(asc(schema.sites.sortOrder));
  const counts = await countBySite(period.id);

  const { site: siteParam } = await searchParams;
  const site = sites.find((s) => String(s.id) === siteParam) ?? sites.find((s) => counts.get(s.id)) ?? sites[0];
  const [rows, vendor] = await Promise.all([listWeeklyRows(period.id, site.id), vendorName()]);

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="週報表" description={`${periodLabel(period)}・姓名與公斤由公糧帶入，這裡補日期與水分`} />
      </div>
      <SiteTabs
        basePath="/weekly"
        sites={sites.map((s) => ({ id: s.id, label: s.weeklySheetName }))}
        activeId={site.id}
        counts={counts}
      />
      <WeeklySheet
        key={site.id}
        site={site}
        period={{ rocYear: period.rocYear, term: period.term }}
        vendor={vendor}
        initialRows={rows}
      />
    </>
  );
}

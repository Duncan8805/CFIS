import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SitePicker } from "@/components/site-picker";
import { requireUser } from "@/lib/auth/session";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { countBySite } from "@/lib/data/grain";
import { listWeeklyRows } from "@/lib/data/weekly";
import { getCalcSettings } from "@/lib/data/settings";
import { listSites, pickSite, rememberedSite, weeklyPendingBySite } from "@/lib/data/sites";
import { WeeklySheet } from "./weekly-sheet";

export const metadata: Metadata = { title: "週報表" };

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const [user, period, sites] = await Promise.all([requireUser(), getCurrentPeriod(), listSites()]);
  const [counts, pending] = await Promise.all([countBySite(period.id), weeklyPendingBySite(period.id)]);
  const site = pickSite(sites, counts, (await searchParams).site, await rememberedSite());
  if (!site) return <PageHeader title="週報表" description="還沒有任何收購點，請先到「設定 → 收購點」新增。" />;
  const [rows, settings] = await Promise.all([listWeeklyRows(period.id, site.id), getCalcSettings(period)]);

  return (
    <SitePicker
      basePath="/weekly"
      sites={sites.map((s) => ({ id: s.id, label: s.weeklySheetName, count: counts.get(s.id) ?? 0, warn: !!pending.get(s.id) }))}
      activeId={site.id}
      canManage={user.role === "admin"}
    >
      <div className="print:hidden">
        <PageHeader
          eyebrow="週報表"
          title={site.weeklySheetName}
          context={`${periodLabel(period)}・收購點：${site.name}`}
          description="姓名、公斤、電話直接讀公糧那一筆，公糧改了這裡就跟著變；這裡只補日期、水分"
        />
      </div>
      <WeeklySheet
        key={`${period.id}-${site.id}`}
        site={site}
        period={{ rocYear: period.rocYear, term: period.term }}
        vendor={settings.vendorName}
        moistureRates={settings.moistureRates}
        initialRows={rows}
      />
    </SitePicker>
  );
}

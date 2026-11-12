import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SitePicker } from "@/components/site-picker";
import { requireUser } from "@/lib/auth/session";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { countBySite, listGrainRecords } from "@/lib/data/grain";
import { listFarmers } from "@/lib/data/farmers";
import { getCalcSettings } from "@/lib/data/settings";
import { listSites, pickSite, rememberedSite } from "@/lib/data/sites";
import { GrainSheet } from "./grain-sheet";

export const metadata: Metadata = { title: "公糧" };

export default async function GrainPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const [user, period, sites] = await Promise.all([requireUser(), getCurrentPeriod(), listSites()]);
  const counts = await countBySite(period.id);
  const site = pickSite(sites, counts, (await searchParams).site, await rememberedSite());
  if (!site) return <PageHeader title="公糧" description="還沒有任何收購點，請先到「設定 → 收購點」新增。" />;

  const [records, farmers, settings] = await Promise.all([
    listGrainRecords(period.id, site.id),
    listFarmers(),
    getCalcSettings(period),
  ]);

  return (
    <SitePicker
      basePath="/grain"
      sites={sites.map((s) => ({ id: s.id, label: s.name, count: counts.get(s.id) ?? 0 }))}
      activeId={site.id}
      canManage={user.role === "admin"}
    >
      <GrainSheet
        key={`${period.id}-${site.id}`}
        site={{ id: site.id, name: site.name, roundingMode: site.roundingMode }}
        context={`${periodLabel(period)}・收購點：${site.name}`}
        settings={settings}
        initialRecords={records}
        farmers={farmers}
      />
    </SitePicker>
  );
}

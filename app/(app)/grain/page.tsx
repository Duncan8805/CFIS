import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
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
      <nav aria-label="收購點" className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-1.5">
          {sites.map((s) => {
            const active = s.id === site.id;
            const n = counts.get(s.id) ?? 0;
            return (
              <li key={s.id}>
                <Link
                  href={`/grain?site=${s.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                    active
                      ? "border-brand-600 bg-brand-600 font-bold text-white"
                      : "border-black/15 bg-white text-black/70 hover:border-brand-500"
                  }`}
                >
                  {s.name}
                  {n > 0 && <span className={`tabular text-xs ${active ? "text-white/80" : "text-black/40"}`}>{n}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <GrainSheet key={site.id} site={site} initialRecords={records} suggestions={suggestions} />
    </>
  );
}

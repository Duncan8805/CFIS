import Link from "next/link";

// 收購點分頁（公糧、週報表共用），像 Excel 底下的工作表分頁

export function SiteTabs({
  basePath,
  sites,
  activeId,
  counts,
}: {
  basePath: string;
  sites: { id: number; label: string }[];
  activeId: number;
  counts: Map<number, number>;
}) {
  return (
    <nav aria-label="收購點" className="no-print -mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1.5">
        {sites.map((s) => {
          const active = s.id === activeId;
          const n = counts.get(s.id) ?? 0;
          return (
            <li key={s.id}>
              <Link
                href={`${basePath}?site=${s.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                  active
                    ? "border-brand-600 bg-brand-600 font-bold text-white"
                    : "border-black/15 bg-white text-black/70 hover:border-brand-500"
                }`}
              >
                {s.label}
                {n > 0 && <span className={`tabular text-xs ${active ? "text-white/80" : "text-black/40"}`}>{n}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

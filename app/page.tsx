import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { NAV_ITEMS } from "@/components/nav-items";

export default function Home() {
  return (
    <>
      <PageHeader title="首頁" description="115 年第 1 期" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {NAV_ITEMS.filter((item) => item.href !== "/").map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-4 hover:border-brand-500"
          >
            <span className="text-brand-600">{item.icon}</span>
            <span className="font-bold">{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

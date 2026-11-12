import Link from "next/link";
import { count, isNull } from "drizzle-orm";
import { buttonClass, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getCurrentPeriod, periodLabel } from "@/lib/data/period";
import { lastChange, periodSummary } from "@/lib/data/summary";

const fmt = (n: number) => n.toLocaleString("zh-TW", { maximumFractionDigits: 2 });

function when(d: Date) {
  const t = new Date(d.getTime() + 8 * 3600_000); // 台灣時間
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

interface Todo {
  title: string;
  detail: string;
  action: string;
  href: string;
}

export default async function Home() {
  const [user, period] = await Promise.all([requireUser(), getCurrentPeriod()]);
  const [summary, change, [noFileNo]] = await Promise.all([
    periodSummary(period),
    lastChange(),
    getDb().select({ n: count() }).from(schema.farmers).where(isNull(schema.farmers.fileNo)),
  ]);
  const { sites, totals } = summary;
  const activeSites = sites.filter((s) => s.site.active);

  const noAgent = activeSites.filter((s) => s.site.remarkMode === "agent_contact" && !s.site.agentContact);
  const pendingSites = sites.filter((s) => s.weeklyPending > 0).sort((a, b) => b.weeklyPending - a.weeklyPending);
  const todos: Todo[] = [
    ...pendingSites.map((s) => ({
      title: `${s.site.weeklySheetName}：週報表 ${s.weeklyPending} 筆沒有日期或水分`,
      detail: s.weeklyPending === s.count ? "整張週報表都還沒填" : `共 ${s.count} 筆，其他已填好`,
      action: "去補",
      href: `/weekly?site=${s.site.id}`,
    })),
    ...sites
      .filter((s) => s.noName > 0)
      .map((s) => ({
        title: `${s.site.name}：${s.noName} 筆沒有姓名`,
        detail: "新增後還沒填，列印時會略過",
        action: "查看",
        href: `/grain?site=${s.site.id}`,
      })),
    ...(noAgent.length
      ? [
          {
            title: noAgent.length === 1 ? `${noAgent[0].site.name}：代收人電話未填` : `${noAgent.length} 個收購點的代收人電話未填`,
            detail: `${noAgent.length > 1 ? noAgent.map((s) => s.site.name).join("、") + "；" : ""}週報表備註會是空白`,
            action: "設定",
            href: `/settings/sites?edit=${noAgent[0].site.id}`,
          },
        ]
      : []),
    ...(noFileNo.n > 0
      ? [
          {
            title: `農民名冊：${noFileNo.n} 位還沒有檔號`,
            detail: "照核定通知單補上檔號，之後統計、找資料比較準",
            action: "去補",
            href: "/farmers",
          },
        ]
      : []),
  ];

  const stats = [
    { label: "公糧筆數", value: fmt(totals.count), sub: `${activeSites.length} 個收購點` },
    { label: "總公斤", value: fmt(totals.kg), sub: "本期累計" },
    {
      label: "週報表待補",
      value: fmt(totals.weeklyPending),
      sub: pendingSites.length
        ? pendingSites
            .slice(0, 3)
            .map((s) => `${s.site.weeklySheetName} ${s.weeklyPending}`)
            .join("、") + (pendingSites.length > 3 ? "…" : "")
        : "全部填好了",
      warn: totals.weeklyPending > 0,
    },
    {
      label: "收",
      value: `NT$ ${fmt(totals.collect)}`,
      sub: [
        totals.collectText ? `另有 ${totals.collectText} 筆寫「扣」` : "",
        totals.depositMissing ? `${totals.depositMissing} 筆入簿未填` : "",
      ]
        .filter(Boolean)
        .join("・") || "入簿 − 先付",
      brand: true,
    },
  ];

  return (
    <div className="max-w-[1180px]">
      <PageHeader
        title="本期總覽"
        description={`${periodLabel(period)}・${activeSites.length} 個收購點${change ? `・最後修改 ${when(change.at)}${change.by ? `（${change.by}）` : ""}` : ""}`}
        actions={
          <>
            <Link href="/grain" className={buttonClass.primary}>
              ＋ 輸入公糧
            </Link>
            {user.role === "admin" && (
              <Link href="/import" className={buttonClass.secondary}>
                匯入 Excel
              </Link>
            )}
          </>
        }
      />

      <section aria-label="本期數字" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-line bg-white px-4 py-4 md:px-5">
            <span className="text-[13px] text-muted">{s.label}</span>
            <span
              className={`tabular truncate text-2xl font-bold xl:text-[28px] ${s.warn ? "text-warn-700" : s.brand ? "text-brand-700" : "text-ink"}`}
            >
              {s.value}
            </span>
            <span className="truncate text-[13px] text-muted">{s.sub}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {todos.length > 0 && (
          <section aria-labelledby="todo-h" className="rounded-[14px] border border-warn-line bg-warn-50 px-5 py-4 lg:w-[360px] lg:shrink-0">
            <h2 id="todo-h" className="mb-3 flex items-center gap-2 text-[17px] font-bold">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-warn-700 text-[13px] text-white">
                {todos.length}
              </span>
              待處理
            </h2>
            <ul className="flex flex-col">
              {todos.slice(0, 8).map((t) => (
                <li key={t.title} className="flex items-center gap-3 border-t border-warn-line py-2.5 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-[13px] text-muted">{t.detail}</div>
                  </div>
                  <Link href={t.href} className="shrink-0 rounded-lg border border-warn-line bg-white px-3 py-1.5 text-sm font-bold text-warn-800">
                    {t.action}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="sites-h" className="min-w-0 flex-1 overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="flex items-baseline gap-3 px-5 pb-2 pt-4">
            <h2 id="sites-h" className="text-[17px] font-bold">
              各收購點
            </h2>
            <span className="text-[13px] text-muted">點名稱直接打開公糧</span>
          </div>
          <div className="overflow-x-auto">
            <table className="tabular w-full min-w-[600px] whitespace-nowrap text-[15px]">
              <thead>
                <tr className="border-y border-line bg-panel text-left text-sm text-ink-2">
                  <th className="px-5 py-2 font-bold">收購點</th>
                  <th className="px-3 py-2 text-right font-bold">筆數</th>
                  <th className="px-3 py-2 text-right font-bold">公斤</th>
                  <th className="px-3 py-2 font-bold">週報表（日期、水分）</th>
                  <th className="px-5 py-2 font-bold">前往</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => {
                  const named = s.count - s.noName;
                  const done = named - s.weeklyPending;
                  const complete = s.weeklyPending === 0;
                  return (
                    <tr key={s.site.id} className="border-t border-line-soft">
                      <td className="px-5 py-2.5 font-medium">
                        <Link href={`/grain?site=${s.site.id}`} className="text-ink hover:text-brand-700">
                          {s.site.name}
                        </Link>
                        {!s.site.active && <span className="ml-2 text-xs text-ghost">停用</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">{s.count}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(s.kg)}</td>
                      <td className="px-3 py-2.5">
                        {s.count > 0 && (
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-line-soft">
                              <div
                                className={`h-full rounded-full ${complete ? "bg-brand-600" : "bg-warn-500"}`}
                                style={{ width: `${named ? Math.round((done / named) * 100) : 100}%` }}
                              />
                            </div>
                            <span className={`text-[13px] ${complete ? "text-muted" : "text-warn-800"}`}>
                              {complete ? "完成" : `${done} / ${named}`}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-sm">
                        <Link href={`/grain?site=${s.site.id}`} className="text-brand-600 hover:underline">
                          公糧
                        </Link>
                        ・
                        <Link href={`/weekly?site=${s.site.id}`} className="text-brand-600 hover:underline">
                          週報表
                        </Link>
                        ・
                        <Link href={`/receipts?site=${s.site.id}`} className="text-brand-600 hover:underline">
                          收款單
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

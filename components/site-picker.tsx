"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { SITE_COOKIE } from "@/lib/data/pick-site";
import { CollapseButton } from "./app-shell";
import { usePersistedToggle } from "./use-persisted-toggle";

// 收購點選單（公糧、週報表、收款單共用），像 Excel 底下的工作表分頁。
// 電腦版：左邊一欄、可以搜尋；手機版：會換行的分頁，不用左右滑就看得到全部收購點。

export interface SiteLink {
  id: number;
  label: string;
  count: number;
  /** 有待處理的事（例如週報表沒填完），名稱旁邊加橘點 */
  warn?: boolean;
}

export function SitePicker({
  basePath,
  sites,
  activeId,
  canManage,
  children,
}: {
  basePath: string;
  sites: SiteLink[];
  activeId: number;
  canManage: boolean;
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  // 收合後只剩一條窄邊，表格可以用更寬的空間；記在這台電腦上
  const [collapsed, toggleCollapsed] = usePersistedToggle("cfis.sites-collapsed", false);
  const active = sites.find((s) => s.id === activeId);
  const q = query.trim();
  const shown = q ? sites.filter((s) => s.label.includes(q)) : sites;
  const href = (id: number) => `${basePath}?site=${id}`;

  // 記住正在看的收購點：換到週報表、收款單時，沒指定就開同一個，不會跳回第一個
  useEffect(() => {
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${SITE_COOKIE}=${activeId}; path=/; max-age=31536000; samesite=lax${secure}`;
  }, [activeId]);

  return (
    <div className="lg:-mb-8 lg:-ml-7 lg:-mr-7 lg:-mt-6 lg:flex lg:min-h-dvh">
      {collapsed && (
        <div className="no-print hidden w-12 shrink-0 flex-col items-center gap-3 border-r border-line bg-panel py-4 lg:flex">
          <CollapseButton collapsed onClick={toggleCollapsed} label="收購點選單" />
          <button
            type="button"
            onClick={toggleCollapsed}
            title="展開收購點選單"
            className="py-2 text-[15px] text-ink-2 [writing-mode:vertical-rl] hover:text-brand-700"
          >
            收購點：<b className="text-brand-700">{active?.label}</b>
          </button>
        </div>
      )}
      <nav
        aria-label="收購點"
        className={`no-print hidden w-[204px] shrink-0 flex-col gap-2 border-r border-line bg-panel px-2 py-4 ${collapsed ? "" : "lg:flex"}`}
      >
        <div className="flex items-center gap-1">
          <span className="flex-1 px-1 text-[14px] font-bold text-ink-2">收購點</span>
          <CollapseButton collapsed={false} onClick={toggleCollapsed} label="收購點選單" />
        </div>
        <label className="flex flex-col gap-1">
          <input
            aria-label="找收購點"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="找收購點"
            className="min-h-11 rounded-[4px] border border-field bg-white px-2.5 text-[15px] text-ink placeholder:text-ghost focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
          />
        </label>
        <ul className="flex flex-col border-y border-line-soft">
          {shown.map((s) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <Link
                  href={href(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 border-b border-line-soft px-2.5 text-[15px] ${
                    active ? "bg-white font-bold text-brand-700 outline outline-1 -outline-offset-1 outline-brand-600" : "text-ink-2 hover:bg-white"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {s.warn && <span className="size-2 shrink-0 rounded-full bg-warn-500" title="有待處理" />}
                  <span className={`tabular text-[14px] ${active ? "text-brand-700" : "text-muted"}`}>{s.count}</span>
                </Link>
              </li>
            );
          })}
          {!shown.length && <li className="px-2.5 py-2.5 text-[14px] text-muted">沒有符合的收購點</li>}
        </ul>
        {canManage && (
          <div className="mt-1 flex flex-col text-[15px]">
            <Link href="/settings/sites?new=1" className="flex min-h-11 items-center rounded-[4px] px-2.5 font-bold text-brand-600 hover:bg-white">
              ＋ 新增收購點
            </Link>
            <Link href="/settings/sites" className="flex min-h-11 items-center rounded-[4px] px-2.5 text-ink-2 hover:bg-white">
              管理收購點…
            </Link>
          </div>
        )}
      </nav>

      <nav aria-label="收購點" className="no-print mb-4 lg:hidden">
        <ul className="flex flex-wrap gap-1.5">
          {sites.map((s) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <Link
                  href={href(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-3 text-[15px] ${
                    active ? "border-brand-600 bg-brand-600 font-bold text-white" : "border-field bg-white text-ink-2"
                  }`}
                >
                  {s.label}
                  {s.warn && !active && <span className="size-2 rounded-full bg-warn-500" title="有待處理" />}
                  {s.count > 0 && <span className={`tabular text-[13px] ${active ? "text-white" : "text-muted"}`}>{s.count}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 lg:px-7 lg:pb-8 lg:pt-6 print:p-0">{children}</div>
    </div>
  );
}

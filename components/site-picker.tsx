"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CollapseButton } from "./app-shell";
import { usePersistedToggle } from "./use-persisted-toggle";

// 收購點選單（公糧、週報表、收款單共用），像 Excel 底下的工作表分頁。
// 電腦版：左邊一欄、可以搜尋；手機版：橫向捲動的分頁。

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

  return (
    <div className="lg:-mb-8 lg:-ml-7 lg:-mr-7 lg:-mt-6 lg:flex lg:min-h-dvh">
      {collapsed && (
        <div className="no-print hidden w-11 shrink-0 flex-col items-center gap-3 border-r border-line bg-panel py-5 lg:flex">
          <CollapseButton collapsed onClick={toggleCollapsed} label="收購點選單" />
          <button
            type="button"
            onClick={toggleCollapsed}
            title="展開收購點選單"
            className="text-sm text-ink-2 [writing-mode:vertical-rl] hover:text-brand-700"
          >
            收購點：<b className="text-brand-700">{active?.label}</b>
          </button>
        </div>
      )}
      <nav
        aria-label="收購點"
        className={`no-print hidden w-[196px] shrink-0 flex-col gap-2.5 border-r border-line bg-panel px-2.5 py-5 ${collapsed ? "" : "lg:flex"}`}
      >
        <div className="flex items-center gap-1">
          <span className="flex-1 text-xs text-muted">收購點</span>
          <CollapseButton collapsed={false} onClick={toggleCollapsed} label="收購點選單" />
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted">
          <input
            aria-label="找收購點"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="找收購點"
            className="rounded-lg border border-field bg-white px-2.5 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none"
          />
        </label>
        <ul className="flex flex-col gap-px">
          {shown.map((s) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <Link
                  href={href(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                    active ? "bg-white font-bold text-brand-700 shadow-[inset_3px_0_0_#2F6F4F]" : "text-ink-2 hover:bg-white/70"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {s.warn && <span className="size-2 shrink-0 rounded-full bg-warn-500" title="有待處理" />}
                  <span className={`tabular text-xs ${active ? "text-brand-700" : "text-faint"}`}>{s.count}</span>
                </Link>
              </li>
            );
          })}
          {!shown.length && <li className="px-2.5 py-2 text-sm text-ghost">沒有符合的收購點</li>}
        </ul>
        {canManage && (
          <div className="mt-1.5 flex flex-col gap-1 border-t border-line pt-2.5 text-sm">
            <Link href="/settings/sites?new=1" className="rounded-lg px-2.5 py-2 font-bold text-brand-600 hover:bg-white/70">
              ＋ 新增收購點
            </Link>
            <Link href="/settings/sites" className="rounded-lg px-2.5 py-2 text-ink-2 hover:bg-white/70">
              管理收購點…
            </Link>
          </div>
        )}
      </nav>

      <nav aria-label="收購點" className="no-print -mx-4 mb-4 overflow-x-auto px-4 md:-mx-7 md:px-7 lg:hidden">
        <ul className="flex w-max gap-1.5">
          {sites.map((s) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <Link
                  href={href(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                    active ? "border-brand-600 bg-brand-600 font-bold text-white" : "border-field bg-white text-ink-2"
                  }`}
                >
                  {s.label}
                  {s.warn && !active && <span className="size-1.5 rounded-full bg-warn-500" />}
                  {s.count > 0 && <span className={`tabular text-xs ${active ? "text-white/80" : "text-faint"}`}>{s.count}</span>}
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

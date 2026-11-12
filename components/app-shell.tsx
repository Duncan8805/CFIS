"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { MOBILE_MORE, MOBILE_TABS, MORE_ICON, NAV_ITEMS, isActive } from "./nav-items";
import { OfflineBanner } from "./offline-banner";
import { usePersistedToggle } from "./use-persisted-toggle";
import { PastPeriodBanner, PeriodSwitcher, type PeriodOption } from "./period-switcher";

export interface ShellPeriods {
  options: PeriodOption[];
  currentId: number;
  latestId: number;
}

function LogoutButton({ className }: { className: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={className}>
        登出
      </button>
    </form>
  );
}

const Logo = ({ small }: { small?: boolean }) => (
  <div
    className={`flex shrink-0 items-center justify-center bg-brand-600 font-bold text-white ${
      small ? "size-8 rounded-lg text-[11px]" : "size-[38px] rounded-[10px] text-[13px]"
    }`}
  >
    長富
  </div>
);

/** 收合／展開按鈕（主選單、收購點選單共用） */
export function CollapseButton({ collapsed, onClick, label }: { collapsed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? "展開" : "收合"}${label}`}
      title={`${collapsed ? "展開" : "收合"}${label}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
        <path d={collapsed ? "M13 6l6 6-6 6M5 6l6 6-6 6" : "M11 6l-6 6 6 6M19 6l-6 6 6 6"} />
      </svg>
    </button>
  );
}

// 電腦／平板（md 以上）：左側選單；手機：上方標題列＋底部分頁列（其他功能收在「更多」）
export function AppShell({
  children,
  user,
  periods,
}: {
  children: ReactNode;
  user: { displayName: string; role: "admin" | "staff" };
  periods: ShellPeriods;
}) {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  // 收合後只剩圖示，讓表格有更多空間；記在這台電腦上
  const [collapsed, toggleCollapsed] = usePersistedToggle("cfis.nav-collapsed", false);
  const current = periods.options.find((p) => p.id === periods.currentId);
  const latest = periods.options.find((p) => p.id === periods.latestId);
  const isPast = periods.currentId !== periods.latestId;
  const switcher = (onNavigate?: () => void) => (
    <PeriodSwitcher
      periods={periods.options}
      currentId={periods.currentId}
      latestId={periods.latestId}
      canCreate={user.role === "admin"}
      onNavigate={onNavigate}
    />
  );

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <div className="min-h-dvh md:flex">
      <aside
        className={`no-print sticky top-0 hidden h-dvh shrink-0 flex-col gap-[18px] border-r border-line bg-white py-5 md:flex ${
          collapsed ? "w-16 items-center px-2" : "w-[232px] px-3.5"
        }`}
      >
        <div className={`flex items-center gap-2.5 ${collapsed ? "flex-col" : "px-1.5"}`}>
          <Logo />
          {!collapsed && <div className="min-w-0 flex-1 text-base font-bold">長富整合平台</div>}
          <CollapseButton collapsed={collapsed} onClick={toggleCollapsed} label="主選單" />
        </div>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            title={`${current?.label ?? ""}（展開選單切換期別）`}
            className={`w-12 rounded-[10px] px-1 py-1.5 text-center text-xs font-bold leading-tight ${
              isPast ? "border-2 border-warn-500 bg-warn-50 text-warn-800" : "border border-line bg-panel"
            }`}
          >
            {current?.label.replace(/ 年第 (\d) 期/, "-$1")}
          </button>
        ) : (
          switcher()
        )}
        <nav aria-label="主選單" className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 rounded-[10px] py-2.5 text-[15px] ${collapsed ? "justify-center px-0 w-11" : "px-3"} ${
                  active ? "bg-brand-100 font-bold text-brand-700" : "text-ink-2 hover:bg-paper"
                }`}
              >
                {item.icon}
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
        <div className={`mt-auto flex items-center gap-2.5 border-t border-line pt-3 ${collapsed ? "flex-col px-0" : "px-2"}`}>
          <div
            title={collapsed ? user.displayName : undefined}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-600"
          >
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{user.displayName}</div>
              <div className="text-xs text-muted">{user.role === "admin" ? "管理員" : "一般使用者"}</div>
            </div>
          )}
          <LogoutButton className="rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-paper" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
          <Logo small />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold leading-tight">長富整合平台</div>
            <div className={`text-xs ${isPast ? "font-bold text-warn-800" : "text-muted"}`}>
              {current?.label}
              {isPast && "（過去的期別）"}
            </div>
          </div>
        </header>
        {isPast && current && latest && <PastPeriodBanner current={current} latest={latest} />}
        <OfflineBanner />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-7 md:pb-8 md:pt-6 print:p-0">{children}</main>
      </div>

      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white md:hidden">
        {MOBILE_TABS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                active ? "font-bold text-brand-600" : "text-muted"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
            MOBILE_MORE.some((i) => isActive(pathname, i.href)) ? "font-bold text-brand-600" : "text-muted"
          }`}
        >
          {MORE_ICON}
          更多
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/30 md:hidden" role="dialog" aria-modal="true" aria-label="更多">
          <button type="button" className="flex-1" onClick={() => setMoreOpen(false)} aria-label="關閉" />
          <div className="pb-safe flex flex-col gap-3 rounded-t-2xl bg-white p-4">
            {switcher(() => setMoreOpen(false))}
            <nav className="flex flex-col gap-0.5">
              {MOBILE_MORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-3 ${
                    isActive(pathname, item.href) ? "bg-brand-100 font-bold text-brand-700" : "text-ink-2"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 border-t border-line pt-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-muted">{user.displayName}</span>
              <LogoutButton className="rounded-md px-3 py-2 text-muted" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

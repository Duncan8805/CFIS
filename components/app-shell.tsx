"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { MOBILE_MORE, MOBILE_TABS, MORE_ICON, NAV_ITEMS, isActive } from "./nav-items";
import { OfflineBanner } from "./offline-banner";
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

/** 收合／展開按鈕（收購點選單用） */
export function CollapseButton({ collapsed, onClick, label }: { collapsed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? "展開" : "收合"}${label}`}
      title={`${collapsed ? "展開" : "收合"}${label}`}
      className="flex size-11 shrink-0 items-center justify-center rounded-[4px] text-muted hover:bg-head hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d={collapsed ? "M13 6l6 6-6 6M5 6l6 6-6 6" : "M11 6l-6 6 6 6M19 6l-6 6 6 6"} />
      </svg>
    </button>
  );
}

// 電腦／平板（md 以上）：上方深色選單列，功能像 Excel 的工作表分頁；
// 手機：上方標題列（期別可以直接點來切換）＋底部分頁列（其他功能收在「更多」）
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
  const current = periods.options.find((p) => p.id === periods.currentId);
  const latest = periods.options.find((p) => p.id === periods.latestId);
  const isPast = periods.currentId !== periods.latestId;
  const switcher = (variant: "chrome" | "mobile") => (
    <PeriodSwitcher
      periods={periods.options}
      currentId={periods.currentId}
      latestId={periods.latestId}
      canCreate={user.role === "admin"}
      variant={variant}
    />
  );

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print hidden flex-wrap items-stretch gap-x-6 bg-chrome px-5 text-chrome-ink md:flex">
        <div className="flex items-center gap-3 py-2.5">
          <span className="whitespace-nowrap text-base font-bold">長富整合平台</span>
          {switcher("chrome")}
        </div>
        <nav aria-label="主選單" className="flex min-w-0 flex-[1_1_420px] flex-wrap items-end gap-0.5 pt-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-t-[4px] px-4 text-[16px] ${
                  active ? "bg-paper font-bold text-ink" : "text-chrome-muted hover:bg-white/10 hover:text-chrome-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 py-2.5">
          <span className="max-w-40 truncate text-[15px] text-chrome-muted" title={user.role === "admin" ? "管理員" : "一般使用者"}>
            {user.displayName}
          </span>
          <LogoutButton className="min-h-11 rounded-[4px] px-3 text-[15px] text-chrome-ink underline-offset-4 hover:bg-white/10 hover:underline" />
        </div>
      </header>

      <header className="no-print sticky top-0 z-20 flex items-center gap-2 bg-chrome px-4 py-2 text-chrome-ink md:hidden">
        <div className="min-w-0 flex-1 truncate text-[16px] font-bold">長富整合平台</div>
        {switcher("mobile")}
      </header>

      {isPast && current && latest && <PastPeriodBanner current={current} latest={latest} />}
      <OfflineBanner />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-7 md:pb-8 md:pt-6 print:p-0">{children}</main>

      <nav
        aria-label="主選單"
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white md:hidden"
      >
        {MOBILE_TABS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-[3px] text-[13px] ${
                active ? "border-brand-600 bg-brand-50 font-bold text-brand-700" : "border-transparent text-muted"
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
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-[3px] text-[13px] ${
            MOBILE_MORE.some((i) => isActive(pathname, i.href))
              ? "border-brand-600 bg-brand-50 font-bold text-brand-700"
              : "border-transparent text-muted"
          }`}
        >
          {MORE_ICON}
          更多
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/30 md:hidden" role="dialog" aria-modal="true" aria-label="更多">
          <button type="button" className="flex-1" onClick={() => setMoreOpen(false)} aria-label="關閉" />
          <div className="pb-safe flex flex-col border-t border-line bg-white">
            <nav className="flex flex-col">
              {MOBILE_MORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-14 items-center gap-3 border-b border-line-soft px-4 text-[17px] ${
                    isActive(pathname, item.href) ? "bg-brand-50 font-bold text-brand-700" : "text-ink-2"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 px-4 py-2 text-[15px]">
              <span className="min-w-0 flex-1 truncate text-muted">{user.displayName}</span>
              <LogoutButton className="min-h-11 rounded-[4px] border border-field px-4 text-[15px] text-ink" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

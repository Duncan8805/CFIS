"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { NAV_ITEMS, isActive } from "./nav-items";
import { OfflineBanner } from "./offline-banner";

function LogoutButton({ className }: { className: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={className}>
        登出
      </button>
    </form>
  );
}

// 電腦／平板（md 以上）：左側選單；手機：底部分頁列
export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="min-h-dvh md:flex">
      <aside className="no-print sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-black/10 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src="/icons/icon-192.png" alt="" className="size-9 rounded-lg" />
          <div>
            <div className="text-base font-bold leading-tight">長富整合平台</div>
            <div className="text-xs text-black/50">115 年第 1 期</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] ${
                  active ? "bg-brand-50 font-bold text-brand-700" : "text-black/70 hover:bg-black/5"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-black/10 px-5 py-4 text-sm">
          <span className="min-w-0 flex-1 truncate text-black/70">{userName}</span>
          <LogoutButton className="rounded-md px-2 py-1 text-black/55 hover:bg-black/5" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <img src="/icons/icon-192.png" alt="" className="size-7 rounded-md" />
          <span className="font-bold">長富整合平台</span>
          <span className="ml-auto truncate text-xs text-black/50">{userName}</span>
          <LogoutButton className="rounded-md px-2 py-1 text-xs text-black/55 hover:bg-black/5" />
        </header>
        <OfflineBanner />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6">{children}</main>
      </div>

      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-black/10 bg-white md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                active ? "font-bold text-brand-600" : "text-black/55"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const icon = (body: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0" aria-hidden="true">
    {body}
  </svg>
);

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "總覽", icon: icon(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />) },
  { href: "/grain", label: "公糧", icon: icon(<path d="M4 4h16v16H4zM4 9h16M4 14h16M9 4v16" />) },
  { href: "/weekly", label: "週報表", icon: icon(<path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3M8 16h6" />) },
  { href: "/receipts", label: "收款單", icon: icon(<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />) },
  {
    href: "/farmers",
    label: "農民",
    icon: icon(
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.6 5.2" />
      </>,
    ),
  },
  { href: "/reports", label: "報表", icon: icon(<path d="M4 20V11M10 20V5M16 20v-7M21 20H3" />) },
  {
    href: "/settings",
    label: "設定",
    icon: icon(
      <>
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>,
    ),
  },
];

/** 手機底部分頁列放前四個，其他收在「更多」 */
export const MOBILE_TABS = NAV_ITEMS.slice(0, 4);
export const MOBILE_MORE = NAV_ITEMS.slice(4);

export const MORE_ICON = icon(
  <>
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="19" cy="12" r="1.2" />
  </>,
);

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  /** 標題上方的小字，例如「公糧」上面放頁面名稱、標題放收購點 */
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end gap-3 md:mb-5">
      <div className="min-w-56 flex-1">
        {eyebrow && <div className="text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="text-[22px] font-bold leading-tight md:text-[26px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted md:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** 頁首的按鈕樣式 */
export const buttonClass = {
  primary:
    "inline-flex h-[42px] items-center gap-2 rounded-[10px] bg-brand-600 px-[18px] font-bold text-white hover:bg-brand-700 disabled:opacity-50",
  secondary:
    "inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-field bg-white px-4 text-ink hover:border-brand-500 disabled:opacity-50",
};

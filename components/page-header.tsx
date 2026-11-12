import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  context,
  description,
  actions,
}: {
  title: string;
  /** 標題上方的小字，例如「公糧」上面放頁面名稱、標題放收購點 */
  eyebrow?: string;
  /** 標題下面一直看得到的一行：正在看哪一期、哪個收購點（例：115 年第 2 期・收購點：朴子） */
  context?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        {eyebrow && <div className="text-[14px] text-muted">{eyebrow}</div>}
        <h1 className="text-[22px] font-bold leading-tight md:text-[24px]">{title}</h1>
        {context && <p className="mt-1 text-[15px] font-medium text-ink-2">{context}</p>}
        {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** 頁首的按鈕樣式 */
export const buttonClass = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] border border-brand-600 bg-brand-600 px-4 text-[15px] font-bold text-white hover:border-brand-700 hover:bg-brand-700 disabled:opacity-50",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] border border-field bg-white px-4 text-[15px] text-ink hover:border-brand-600 hover:text-brand-700 disabled:opacity-50",
};

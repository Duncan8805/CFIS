import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-black/60">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ComingSoon({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-dashed border-black/20 bg-white p-5">
      <p className="text-sm font-bold text-black/70">下一階段會做：</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-black/70">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

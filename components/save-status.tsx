"use client";

// 表格上方的儲存狀態列（公糧、週報表共用）：全部已儲存／儲存中…／有 N 格沒存到

export function SaveStatus({ saving, failed, hint }: { saving: boolean; failed: number; hint?: string }) {
  const state = failed > 0 ? "failed" : saving ? "saving" : "saved";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-[60px] z-10 mb-3 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-[4px] border px-3 py-1.5 text-[15px] md:top-0 print:hidden ${
        state === "failed" ? "border-red-700 bg-red-50 text-red-800" : "border-line bg-white text-ink-2"
      }`}
    >
      <span className="inline-flex items-center gap-2 font-bold">
        <span
          aria-hidden="true"
          className={`size-2.5 shrink-0 rounded-full ${
            state === "failed" ? "bg-red-700" : state === "saving" ? "animate-pulse bg-warn-500" : "bg-brand-600"
          }`}
        />
        {state === "failed" ? `有 ${failed} 格沒存到` : state === "saving" ? "儲存中…" : "全部已儲存"}
      </span>
      {state === "failed" ? (
        <span className="text-[14px]">紅框的格子：改好後按 Enter 再存一次，或按 Esc 恢復原本的值</span>
      ) : (
        hint && <span className="hidden text-[14px] text-muted md:inline">{hint}</span>
      )}
    </div>
  );
}

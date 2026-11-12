"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSite, saveSite, type SiteInput } from "@/app/actions/settings";
import { buttonClass, PageHeader } from "@/components/page-header";
import { inputClass } from "./ui";

export type SiteRow = Required<Omit<SiteInput, "id">> & { id: number; currentCount: number; totalCount: number };
type Draft = Required<Omit<SiteInput, "id">> & { id?: number };

const blank = (sortOrder: number): Draft => ({
  name: "",
  weeklySheetName: "",
  sellTo: "",
  remarkMode: "farmer_phone",
  agentContact: null,
  roundingMode: "truncate",
  sortOrder,
  active: true,
});

function toDraft(site: SiteRow): Draft {
  const { currentCount, totalCount, ...draft } = site;
  void currentCount;
  void totalCount;
  return draft;
}

// 收購點管理：左邊清單、右邊編輯。停用的不會出現在輸入畫面（資料保留）；完全沒有資料的才能刪除。
export function SitesManager({
  sites,
  startNew,
  startEditId,
}: {
  sites: SiteRow[];
  startNew: boolean;
  startEditId: number | null;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<number | "new" | null>(startNew ? "new" : startEditId);
  const inactive = sites.filter((s) => !s.active).length;
  const shown = sites.filter((s) => showInactive || s.active || s.id === editing);
  const nextOrder = Math.max(0, ...sites.map((s) => s.sortOrder)) + 10;
  const site = typeof editing === "number" ? sites.find((s) => s.id === editing) : undefined;

  return (
    <>
      <PageHeader
        title="收購點"
        description="每個收購點對應公糧 Excel 的一張工作表。停用的收購點不會出現在輸入畫面，資料保留。"
        actions={
          <>
            {inactive > 0 && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-ink-2">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="size-[22px] shrink-0 accent-brand-600"
                />
                顯示已停用（{inactive}）
              </label>
            )}
            <button type="button" onClick={() => setEditing("new")} className={buttonClass.primary}>
              ＋ 新增收購點
            </button>
          </>
        }
      />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <section aria-label="收購點清單" className="min-w-0 flex-1 overflow-hidden rounded-[4px] border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse whitespace-nowrap text-[15px] [&_td]:border [&_td]:border-line-soft [&_th]:border [&_th]:border-line-soft">
              <thead>
                <tr className="border-b-2 border-line bg-head text-left text-[15px] text-ink-2">
                  <th className="px-2.5 py-2 font-bold">收購點</th>
                  <th className="px-2.5 py-2 font-bold">週報表名稱</th>
                  <th className="px-2.5 py-2 font-bold">繳售業者</th>
                  <th className="px-2.5 py-2 font-bold">備註填</th>
                  <th className="px-2.5 py-2 font-bold">利、運費</th>
                  <th className="px-2.5 py-2 text-right font-bold">本期筆數</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const selected = s.id === editing;
                  const missing = s.remarkMode === "agent_contact" && !s.agentContact;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setEditing(s.id)}
                      className={`cursor-pointer ${
                        selected ? "bg-brand-50 font-bold outline outline-1 -outline-offset-1 outline-brand-600" : "hover:bg-paper"
                      } ${s.active ? "" : "text-muted"}`}
                    >
                      <td className="px-2.5 py-1 font-bold">
                        <button type="button" className="min-h-9 text-left underline-offset-4 hover:underline" onClick={() => setEditing(s.id)}>
                          {s.name}
                        </button>
                        {!s.active && <span className="ml-2 text-[13px] font-normal">停用</span>}
                      </td>
                      <td className="px-2.5 py-2">{s.weeklySheetName}</td>
                      <td className="px-2.5 py-2">{s.sellTo}</td>
                      <td className={`px-2.5 py-2 ${missing ? "bg-warn-50 text-warn-800" : ""}`}>
                        {s.remarkMode === "agent_contact" ? `代收人${s.agentContact ? "" : "（未填）"}` : "農民電話"}
                      </td>
                      <td className="px-2.5 py-2">{s.roundingMode === "truncate" ? "捨去" : "不捨去"}</td>
                      <td className="tabular px-2.5 py-2 text-right">{s.currentCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {editing !== null && (
          <SiteEditor
            key={`${editing}-${site?.active}`}
            initial={site ? toDraft(site) : blank(nextOrder)}
            counts={site ? { current: site.currentCount, total: site.totalCount } : null}
            onClose={() => setEditing(null)}
            onCreated={(id) => setEditing(id)}
          />
        )}
      </div>
    </>
  );
}

function SiteEditor({
  initial,
  counts,
  onClose,
  onCreated,
}: {
  initial: Draft;
  counts: { current: number; total: number } | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm((f) => ({ ...f, [key]: value }));

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
  };

  const save = (values: Draft) =>
    run(async () => {
      const r = await saveSite({ ...values, agentContact: values.agentContact || null });
      if (!r.ok) return r.error;
      router.refresh();
      if (!initial.id) onCreated(r.data.id);
      return null;
    });

  const remove = () =>
    run(async () => {
      if (!initial.id || !confirm(`刪除收購點「${initial.name}」？`)) return null;
      const r = await deleteSite(initial.id);
      if (!r.ok) return r.error;
      router.refresh();
      onClose();
      return null;
    });

  const label = "flex flex-col gap-1.5 text-[14px] text-ink-2";
  const radio = "flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-ink";

  return (
    <aside aria-label="編輯收購點" className="flex w-full shrink-0 flex-col gap-4 rounded-[4px] border border-line bg-white p-4 xl:w-[380px]">
      <div className="-mx-4 -mt-4 flex items-center gap-2 border-b border-line bg-head px-4 py-1.5">
        <h2 className="flex-1 text-[16px] font-bold">{initial.id ? `編輯：${initial.name}` : "新增收購點"}</h2>
        <button type="button" onClick={onClose} className="inline-flex min-h-11 shrink-0 items-center rounded-[4px] border border-field bg-white px-3 text-[15px] text-ink hover:border-brand-600">
          關閉
        </button>
      </div>
      <label className={label}>
        收購點名稱（公糧 Excel 工作表名稱）
        <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label className={label}>
        週報表工作表名稱
        <input
          className={inputClass}
          value={form.weeklySheetName}
          placeholder={form.name ? `空白就用「${form.name}」` : undefined}
          onChange={(e) => set("weeklySheetName", e.target.value)}
        />
      </label>
      <label className={label}>
        預計繳售公糧業者
        <input className={inputClass} value={form.sellTo} onChange={(e) => set("sellTo", e.target.value)} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[14px] text-ink-2">週報表備註要填</legend>
        <label className={radio}>
          <input
            type="radio"
            checked={form.remarkMode === "farmer_phone"}
            onChange={() => set("remarkMode", "farmer_phone")}
            className="size-[22px] shrink-0 accent-brand-600"
          />
          每位農民自己的電話
        </label>
        <label className={radio}>
          <input
            type="radio"
            checked={form.remarkMode === "agent_contact"}
            onChange={() => set("remarkMode", "agent_contact")}
            className="size-[22px] shrink-0 accent-brand-600"
          />
          代收人的電話
        </label>
      </fieldset>
      {form.remarkMode === "agent_contact" && (
        <label className={`${label} ${form.agentContact ? "" : "!text-warn-800"}`}>
          代收人電話{form.agentContact ? "" : "（還沒填）"}
          <input
            className={inputClass}
            value={form.agentContact ?? ""}
            placeholder="例：珍0910163244/3703527"
            onChange={(e) => set("agentContact", e.target.value)}
          />
        </label>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[14px] text-ink-2">利、運費</legend>
        <label className={radio}>
          <input
            type="radio"
            checked={form.roundingMode === "truncate"}
            onChange={() => set("roundingMode", "truncate")}
            className="size-[22px] shrink-0 accent-brand-600"
          />
          無條件捨去（ROUNDDOWN）
        </label>
        <label className={radio}>
          <input
            type="radio"
            checked={form.roundingMode === "none"}
            onChange={() => set("roundingMode", "none")}
            className="size-[22px] shrink-0 accent-brand-600"
          />
          不捨去，保留小數
        </label>
      </fieldset>
      <label className={label}>
        排序（小的在前）
        <input
          className={`${inputClass} tabular !w-32`}
          inputMode="numeric"
          value={form.sortOrder}
          onChange={(e) => set("sortOrder", Number(e.target.value.replace(/\D/g, "")) || 0)}
        />
      </label>

      {error && <p role="alert" className="rounded-[4px] border border-red-700 bg-red-50 px-3 py-2 text-[15px] text-red-800">{error}</p>}
      <div className="flex gap-2.5">
        <button
          type="button"
          disabled={busy || (!!initial.id && !dirty)}
          onClick={() => save({ ...form, weeklySheetName: form.weeklySheetName.trim() || form.name })}
          className="min-h-11 flex-1 rounded-[4px] bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? "儲存中…" : initial.id ? "儲存" : "新增"}
        </button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-[4px] border border-field bg-white px-4 text-[15px]">
          取消
        </button>
      </div>

      {initial.id && counts && (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
          <div className="text-[15px] font-bold">停用或刪除</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ ...initial, active: !initial.active })}
              className="min-h-11 rounded-[4px] border border-field bg-white px-4 text-[15px] hover:border-brand-600"
            >
              {initial.active ? "停用這個收購點" : "重新啟用"}
            </button>
            <button
              type="button"
              disabled={busy || counts.total > 0}
              onClick={remove}
              className="min-h-11 rounded-[4px] border border-red-300 bg-white px-4 text-[15px] text-red-700 disabled:border-line disabled:text-muted"
            >
              刪除
            </button>
          </div>
          <p className="text-[14px] text-muted">
            {counts.total > 0
              ? `還有 ${counts.total} 筆公糧資料${counts.total !== counts.current ? `（本期 ${counts.current} 筆）` : ""}，不能刪除，只能停用。沒有任何資料的收購點才能刪除。`
              : "這個收購點沒有任何公糧資料，可以刪除。"}
          </p>
        </div>
      )}
    </aside>
  );
}

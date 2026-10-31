"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSite, type SiteInput } from "@/app/actions/settings";
import { Field, inputClass, SaveButton, Section, useSave } from "./ui";

export type SiteRow = Required<Omit<SiteInput, "id">> & { id: number };

const blank = (sortOrder: number): Omit<SiteRow, "id"> & { id?: number } => ({
  name: "",
  weeklySheetName: "",
  sellTo: "",
  remarkMode: "farmer_phone",
  agentContact: null,
  roundingMode: "truncate",
  sortOrder,
  active: true,
});

export function SettingsSites({ sites }: { sites: SiteRow[] }) {
  const [adding, setAdding] = useState(false);
  const nextOrder = Math.max(0, ...sites.map((s) => s.sortOrder)) + 10;
  return (
    <Section
      id="sites"
      title="收購點"
      description="每個收購點對應公糧 Excel 的一張工作表。這裡的設定決定週報表的工作表名稱、繳售業者、備註要填誰的電話，以及利、運費要不要無條件捨去。"
    >
      <div className="flex flex-col gap-3">
        {adding && <SiteForm initial={blank(nextOrder)} onDone={() => setAdding(false)} />}
        {sites.map((s) => (
          <SiteForm key={s.id} initial={s} />
        ))}
      </div>
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 rounded-lg border border-dashed border-brand-500 px-4 py-2 text-sm font-bold text-brand-700"
        >
          ＋ 新增收購點
        </button>
      )}
    </Section>
  );
}

function SiteForm({ initial, onDone }: { initial: Omit<SiteRow, "id"> & { id?: number }; onDone?: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  // 平常只顯示一行摘要，按「編輯」才展開；新增的直接展開
  const [open, setOpen] = useState(!initial.id);
  const { status, run } = useSave();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    run(async () => {
      const r = await saveSite({ ...form, agentContact: form.agentContact || null });
      if (!r.ok) return r.error;
      router.refresh();
      onDone?.();
      return null;
    });

  if (!open) {
    return (
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-black/10 px-3 py-2.5 text-sm ${
          form.active ? "" : "bg-black/[0.03] text-black/45"
        }`}
      >
        <span className="min-w-20 font-bold text-black">{form.name}</span>
        <span className="text-black/60">週報表：{form.weeklySheetName}</span>
        <span className="text-black/60">繳售：{form.sellTo}</span>
        <span className="text-black/60">備註：{form.remarkMode === "agent_contact" ? `代收人 ${form.agentContact ?? "（未填）"}` : "農民電話"}</span>
        <span className="text-black/60">{form.roundingMode === "truncate" ? "捨去" : "不捨去"}</span>
        {!form.active && <span>（停用）</span>}
        {status.kind === "saved" && <span className="text-brand-700">已儲存</span>}
        <button type="button" onClick={() => setOpen(true)} className="ml-auto rounded-md px-2 py-1 text-brand-700 hover:bg-brand-50">
          編輯
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${form.active ? "border-black/10" : "border-black/10 bg-black/[0.03]"}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="收購點名稱（公糧 Excel 工作表）">
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="週報表工作表名稱">
          <input className={inputClass} value={form.weeklySheetName} onChange={(e) => set("weeklySheetName", e.target.value)} />
        </Field>
        <Field label="預計繳售公糧業者名稱">
          <input className={inputClass} value={form.sellTo} onChange={(e) => set("sellTo", e.target.value)} />
        </Field>
        <Field label="利、運費">
          <select
            className={inputClass}
            value={form.roundingMode}
            onChange={(e) => set("roundingMode", e.target.value as SiteRow["roundingMode"])}
          >
            <option value="truncate">無條件捨去（ROUNDDOWN）</option>
            <option value="none">不捨去</option>
          </select>
        </Field>
        <Field label="週報表備註">
          <select
            className={inputClass}
            value={form.remarkMode}
            onChange={(e) => set("remarkMode", e.target.value as SiteRow["remarkMode"])}
          >
            <option value="farmer_phone">填農民電話</option>
            <option value="agent_contact">填代收人電話</option>
          </select>
        </Field>
        <Field label="代收人電話" wide>
          <input
            className={inputClass}
            value={form.agentContact ?? ""}
            disabled={form.remarkMode !== "agent_contact"}
            placeholder={form.remarkMode === "agent_contact" ? "例：珍0910163244/3703527" : "備註填農民電話時不需要"}
            onChange={(e) => set("agentContact", e.target.value)}
          />
        </Field>
        <Field label="排序（小的在前）">
          <input
            className={inputClass}
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="size-4 accent-brand-600"
          />
          使用中（取消後不會出現在分頁，資料保留）
        </label>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onDone) return onDone();
              setForm(initial);
              setOpen(false);
            }}
            className="text-sm text-black/55"
          >
            {onDone ? "取消" : "收起"}
          </button>
          <SaveButton
            status={status}
            dirty={dirty || !initial.id}
            onClick={async () => {
              if ((await save()) && initial.id) setOpen(false);
            }}
            label={initial.id ? "儲存" : "新增"}
          />
        </div>
      </div>
    </div>
  );
}

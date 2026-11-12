"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBankAccount, type AccountInput } from "@/app/actions/settings";
import { Field, inputClass, SaveButton, Section, useSave } from "./ui";

export type AccountRow = Required<Omit<AccountInput, "id">> & { id: number };

export function SettingsAccounts({ accounts }: { accounts: AccountRow[] }) {
  const [adding, setAdding] = useState(false);
  const nextOrder = Math.max(0, ...accounts.map((a) => a.sortOrder)) + 10;
  return (
    <Section id="accounts" title="農會帳號" description="印在收款單上的帳號。列印時可以勾選要印哪幾個。">
      <div className="flex flex-col gap-3">
        {accounts.map((a) => (
          <AccountForm key={a.id} initial={a} />
        ))}
        {adding && (
          <AccountForm
            initial={{ org: "", unitCode: "", accountNo: "", holder: "", sortOrder: nextOrder, active: true }}
            onDone={() => setAdding(false)}
          />
        )}
      </div>
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 min-h-11 rounded-[4px] border border-dashed border-brand-600 bg-white px-4 text-[15px] font-bold text-brand-700"
        >
          ＋ 新增帳號
        </button>
      )}
    </Section>
  );
}

function AccountForm({ initial, onDone }: { initial: Omit<AccountRow, "id"> & { id?: number }; onDone?: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const { status, run } = useSave();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    run(async () => {
      const r = await saveBankAccount(form);
      if (!r.ok) return r.error;
      router.refresh();
      onDone?.();
      return null;
    });

  return (
    <div className={`rounded-[4px] border border-line p-3 ${form.active ? "" : "bg-panel"}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="農會">
          <input className={inputClass} value={form.org} onChange={(e) => set("org", e.target.value)} placeholder="例：鹿草農會本會" />
        </Field>
        <Field label="單位代號">
          <input className={`${inputClass} tabular`} inputMode="numeric" value={form.unitCode} onChange={(e) => set("unitCode", e.target.value)} />
        </Field>
        <Field label="帳號">
          <input className={`${inputClass} tabular`} inputMode="numeric" value={form.accountNo} onChange={(e) => set("accountNo", e.target.value)} />
        </Field>
        <Field label="戶名">
          <input className={inputClass} value={form.holder} onChange={(e) => set("holder", e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="size-[22px] shrink-0 accent-brand-600" />
          使用中
        </label>
        <label className="flex min-h-11 items-center gap-2 text-[15px]">
          排序
          <input
            className={`${inputClass} w-20 text-right`}
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </label>
        <div className="ml-auto flex items-center gap-3">
          {onDone && (
            <button type="button" onClick={onDone} className="min-h-11 rounded-[4px] border border-field bg-white px-4 text-[15px] text-ink">
              取消
            </button>
          )}
          <SaveButton status={status} dirty={dirty || !initial.id} onClick={save} label={initial.id ? "儲存" : "新增"} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, resetPassword, updateUser } from "@/app/actions/settings";
import { Field, inputClass, SaveButton, Section, useSave } from "./ui";

export interface UserRow {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "staff";
  active: boolean;
}

const ROLE_LABEL = { admin: "管理員（可以匯入、改設定）", staff: "一般（輸入公糧、週報表、印收款單）" };

export function SettingsUsers({ users, currentUserId }: { users: UserRow[]; currentUserId: number }) {
  return (
    <Section id="users" title="使用者" description="可以登入系統的帳號。停用的帳號會立刻被登出。">
      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <UserForm key={u.id} initial={u} isSelf={u.id === currentUserId} />
        ))}
      </div>
      <NewUserForm />
    </Section>
  );
}

function UserForm({ initial, isSelf }: { initial: UserRow; isSelf: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [resetting, setResetting] = useState(false);
  const { status, run } = useSave();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = () =>
    run(async () => {
      const r = await updateUser({ id: form.id, displayName: form.displayName, role: form.role, active: form.active });
      if (!r.ok) return r.error;
      router.refresh();
      return null;
    });

  return (
    <div className={`rounded-lg border border-line p-3 ${form.active ? "" : "bg-panel"}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="帳號">
          <input className={inputClass} value={form.username} disabled />
        </Field>
        <Field label="名稱">
          <input className={inputClass} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </Field>
        <Field label="權限">
          <select
            className={inputClass}
            value={form.role}
            disabled={isSelf}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRow["role"] })}
          >
            <option value="admin">{ROLE_LABEL.admin}</option>
            <option value="staff">{ROLE_LABEL.staff}</option>
          </select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            disabled={isSelf}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="size-4 accent-brand-600"
          />
          可以登入
        </label>
        {isSelf && <span className="text-sm text-faint">（這是你自己的帳號）</span>}
        <button type="button" onClick={() => setResetting((v) => !v)} className="text-sm text-brand-700">
          {resetting ? "取消重設密碼" : "重設密碼"}
        </button>
        <div className="ml-auto">
          <SaveButton status={status} dirty={dirty} onClick={save} />
        </div>
      </div>
      {resetting && <ResetPassword userId={form.id} onDone={() => setResetting(false)} />}
    </div>
  );
}

function ResetPassword({ userId, onDone }: { userId: number; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const { status, run } = useSave();
  const save = () =>
    run(async () => {
      if (password !== again) return "兩次輸入的密碼不一樣";
      const r = await resetPassword({ id: userId, password });
      if (!r.ok) return r.error;
      onDone();
      return null;
    });
  return (
    <div className="mt-3 grid grid-cols-1 items-end gap-3 rounded-lg bg-brand-50 p-3 sm:grid-cols-3">
      <Field label="新密碼（至少 8 個字元）">
        <input type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="再輸入一次">
        <input type="password" autoComplete="new-password" className={inputClass} value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      <SaveButton status={status} dirty={password.length > 0} onClick={save} label="重設密碼" />
    </div>
  );
}

function NewUserForm() {
  const router = useRouter();
  const empty = { username: "", displayName: "", role: "staff" as UserRow["role"], password: "", again: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const { status, run } = useSave();

  const save = () =>
    run(async () => {
      if (form.password !== form.again) return "兩次輸入的密碼不一樣";
      const r = await createUser({ username: form.username, displayName: form.displayName, role: form.role, password: form.password });
      if (!r.ok) return r.error;
      setForm(empty);
      setOpen(false);
      router.refresh();
      return null;
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg border border-dashed border-brand-500 px-4 py-2 text-sm font-bold text-brand-700"
      >
        ＋ 新增使用者
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-brand-500 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="帳號（登入用，英文或數字）">
          <input className={inputClass} autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </Field>
        <Field label="名稱">
          <input className={inputClass} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </Field>
        <Field label="權限">
          <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRow["role"] })}>
            <option value="staff">{ROLE_LABEL.staff}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
          </select>
        </Field>
        <Field label="密碼（至少 8 個字元）">
          <input type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="再輸入一次">
          <input type="password" autoComplete="new-password" className={inputClass} value={form.again} onChange={(e) => setForm({ ...form, again: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">
          取消
        </button>
        <SaveButton status={status} dirty={!!form.username && !!form.password} onClick={save} label="新增" />
      </div>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const inputClass =
  "min-h-12 w-full rounded-[4px] border border-field bg-white px-3 text-[17px] text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-ink-2">帳號</span>
        <input
          name="username"
          defaultValue={state.username}
          autoComplete="username"
          autoCapitalize="none"
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-ink-2">密碼</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus={!!state.username}
          required
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-[4px] border border-red-700 bg-red-50 px-3 py-2 text-[15px] text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-[4px] bg-brand-600 px-4 text-[17px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}

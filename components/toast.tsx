"use client";

import { useCallback, useRef, useState } from "react";

export type ToastTone = "error" | "info";

/** 提示訊息：顯示 5 秒後自動消失。錯誤是紅色，一般提醒（例如從名冊帶出資料）是深綠色 */
export function useToast() {
  const [state, setState] = useState<{ message: string; tone: ToastTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, tone: ToastTone = "error") => {
    setState({ message: text, tone });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 5000);
  }, []);
  return { message: state?.message ?? null, tone: state?.tone ?? "error", show };
}

export function Toast({ message, tone = "error" }: { message: string | null; tone?: ToastTone }) {
  if (!message) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-lg px-4 py-3 text-sm text-white shadow-lg print:hidden md:bottom-6 ${
        tone === "error" ? "bg-red-700" : "bg-brand-700"
      }`}
    >
      {message}
    </div>
  );
}

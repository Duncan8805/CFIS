"use client";

import { useCallback, useRef, useState } from "react";

export type ToastTone = "error" | "info";

/**
 * 提示訊息。錯誤是紅色，會一直留著，直到使用者按「知道了」；
 * 一般提醒（例如從名冊帶出資料）是深綠色，5 秒後自動消失。
 */
export function useToast() {
  const [state, setState] = useState<{ message: string; tone: ToastTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, tone: ToastTone = "error") => {
    // 還沒按「知道了」的錯誤，不要被一般提醒蓋掉
    setState((prev) => (tone === "info" && prev?.tone === "error" ? prev : { message: text, tone }));
    clearTimeout(timer.current);
    if (tone === "info") {
      timer.current = setTimeout(() => setState((prev) => (prev?.tone === "info" ? null : prev)), 5000);
    }
  }, []);
  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setState(null);
  }, []);
  return { message: state?.message ?? null, tone: state?.tone ?? "error", show, dismiss };
}

export function Toast({
  message,
  tone = "error",
  onClose,
}: {
  message: string | null;
  tone?: ToastTone;
  onClose?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[4px] px-4 py-3 text-[15px] text-white shadow-[0_4px_12px_rgba(30,38,51,0.25)] print:hidden md:bottom-6 ${
        tone === "error" ? "bg-red-700" : "bg-brand-700"
      }`}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {tone === "error" && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 shrink-0 rounded-[4px] border border-white px-3 font-bold text-white hover:bg-white/10"
        >
          知道了
        </button>
      )}
    </div>
  );
}

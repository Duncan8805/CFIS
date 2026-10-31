"use client";

import { useCallback, useRef, useState } from "react";

/** 錯誤提示：顯示 5 秒後自動消失 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 5000);
  }, []);
  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-lg print:hidden md:bottom-6"
    >
      {message}
    </div>
  );
}

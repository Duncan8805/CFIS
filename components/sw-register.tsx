"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // 開發模式不註冊，避免快取干擾熱更新
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.error("Service worker 註冊失敗", err));
  }, []);
  return null;
}

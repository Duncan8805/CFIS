"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// 第一版離線時只能看資料，不能輸入
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="no-print bg-amber-100 px-4 py-2 text-sm text-amber-900">
      目前沒有網路：只能查看上次載入的資料，恢復連線後才能輸入或修改。
    </div>
  );
}

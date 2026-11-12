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
    <div role="status" className="no-print border-b border-warn-line bg-warn-100 px-4 py-2.5 text-[15px] text-warn-800 md:px-7">
      目前沒有網路：只能查看上次載入的資料，恢復連線後才能輸入或修改。
    </div>
  );
}

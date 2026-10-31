import type { Metadata } from "next";

export const metadata: Metadata = { title: "沒有網路" };

// service worker 預先快取這頁，離線又沒有快取的頁面時顯示
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-bold">目前沒有網路</h1>
      <p className="mt-2 text-sm text-black/60">這一頁還沒有存在這台裝置上。恢復連線後再試一次。</p>
    </div>
  );
}

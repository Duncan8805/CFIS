import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "收款單" };

export default function ReceiptsPage() {
  return (
    <>
      <PageHeader title="收款單" description="A4 一頁 6 張" />
      <ComingSoon items={["選收購點或勾選農民列印收款單", "勾選要印的農會帳號", "略過金額為 0 的紀錄"]} />
    </>
  );
}

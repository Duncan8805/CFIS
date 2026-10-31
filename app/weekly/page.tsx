import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "週報表" };

export default function WeeklyPage() {
  return (
    <>
      <PageHeader title="週報表" description="姓名、公斤由公糧自動帶入" />
      <ComingSoon
        items={[
          "依收購點顯示週報表，補進倉日期與水分",
          "隨機產生水分（照原巨集的機率，保證至少一個 30）",
          "列印模式：隱藏公斤與折算欄，每 26 筆小計",
          "匯出 Excel",
        ]}
      />
    </>
  );
}

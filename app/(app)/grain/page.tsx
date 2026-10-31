import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon, PageHeader } from "@/components/page-header";
import { GrainCalculator } from "./grain-calculator";

export const metadata: Metadata = { title: "公糧" };

export default function GrainPage() {
  return (
    <>
      <PageHeader
        title="公糧"
        description="輸入後自動帶入週報表"
        actions={
          <Link href="/import" className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm hover:border-brand-500">
            匯入 Excel
          </Link>
        }
      />
      <GrainCalculator />
      <div className="mt-5">
        <ComingSoon
          items={[
            "依收購點切換的輸入表格（電腦版像 Excel，手機版卡片）",
            "打姓名自動帶出電話、地址",
            "匯出 Excel（含公式與每 26 筆小計）",
          ]}
        />
      </div>
    </>
  );
}

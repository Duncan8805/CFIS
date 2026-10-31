import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "設定" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="設定" />
      <Link
        href="/import"
        className="mb-5 flex items-center justify-between rounded-xl border border-black/10 bg-white p-4 hover:border-brand-500"
      >
        <span>
          <span className="block font-bold">匯入 Excel</span>
          <span className="text-sm text-black/55">把現有的公糧 Excel 與週報表轉進系統</span>
        </span>
        <span aria-hidden="true" className="text-black/40">
          →
        </span>
      </Link>
      <ComingSoon
        items={[
          "收購點：週報表名稱、繳售業者、備註規則、代收人電話、捨入規則",
          "每分利（4000）、每公斤運費（0.35）、水分折算率表",
          "收款單上的農會帳號",
          "使用者帳號",
        ]}
      />
    </>
  );
}

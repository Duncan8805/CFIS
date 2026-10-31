import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "設定" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="設定" />
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

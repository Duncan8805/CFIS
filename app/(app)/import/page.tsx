import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { getImportContext } from "@/app/actions/import";
import { ImportClient } from "./import-client";

export const metadata: Metadata = { title: "匯入 Excel" };

export default async function ImportPage() {
  const user = await requireUser();
  if (user.role !== "admin") {
    return (
      <>
        <PageHeader title="匯入 Excel" />
        <p className="rounded-[4px] border border-line bg-white p-5 text-[15px] text-muted">只有管理員可以匯入資料。</p>
      </>
    );
  }
  const context = await getImportContext();
  return (
    <>
      <PageHeader
        title="匯入 Excel"
        description={`把現有的公糧 Excel 與週報表轉進系統（${context.periodLabel}）。檔案只在這台電腦上讀取，確認後才寫入。`}
      />
      <ImportClient context={context} />
    </>
  );
}

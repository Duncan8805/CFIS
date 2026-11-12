"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  countCurrentRecords,
  createFarmer,
  getFarmerHistory,
  updateFarmer,
  type FarmerHistoryItem,
} from "@/app/actions/farmers";
import type { FarmerRow } from "@/lib/data/farmers";
import { splitPhones } from "@/lib/grain/fields";
import { buttonClass, PageHeader } from "@/components/page-header";

type Filter = "all" | "current" | "noFileNo";
const PAGE = 50;

const fmt = (n: number | null) => (n === null ? "" : n.toLocaleString("zh-TW"));

// 農民名冊：每位農民一筆，用檔號辨認。改電話等資料時，問要不要一起更新作業中那一期的紀錄。
export function FarmersClient({
  farmers,
  periodLabel,
  latestLabel,
}: {
  farmers: FarmerRow[];
  /** 「本期」欄位用的期別（正在看的那一期） */
  periodLabel: string;
  /** 作業中的期別（改資料時一起更新的那一期） */
  latestLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<number | "new" | null>(null);

  const q = query.trim().toUpperCase();
  const counts = {
    all: farmers.length,
    current: farmers.filter((f) => f.sites.length).length,
    noFileNo: farmers.filter((f) => !f.fileNo).length,
  };
  const filtered = useMemo(
    () =>
      farmers.filter(
        (f) =>
          (filter === "all" || (filter === "current" ? f.sites.length > 0 : !f.fileNo)) &&
          (!q || [f.fileNo, f.name, f.phone].some((v) => v && v.toUpperCase().includes(q))),
      ),
    [farmers, filter, q],
  );
  useEffect(() => setLimit(PAGE), [filter, q]);
  const farmer = typeof selected === "number" ? farmers.find((f) => f.id === selected) : undefined;

  const chip = (key: Filter, label: string) => (
    <button
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter(key)}
      className={`h-9 whitespace-nowrap rounded-full border px-3.5 text-sm ${
        filter === key ? "border-brand-600 bg-brand-600 font-bold text-white" : "border-field bg-white text-ink-2 hover:border-brand-500"
      }`}
    >
      {label} <span className="tabular">{counts[key]}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        title="農民名冊"
        description="每位農民一筆，用檔號辨認。公糧輸入時打檔號就會從這裡帶出姓名、電話、地址。"
        actions={
          <button type="button" onClick={() => setSelected("new")} className={buttonClass.primary}>
            ＋ 新增農民
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-[42px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-field bg-white px-3 text-muted focus-within:border-brand-500 sm:max-w-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px] shrink-0" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="找檔號、姓名或電話"
            placeholder="找檔號、姓名或電話"
            className="min-w-0 flex-1 bg-transparent text-ink outline-none"
          />
        </label>
        <div role="group" aria-label="篩選" className="flex gap-2 overflow-x-auto">
          {chip("all", "全部")}
          {chip("current", "本期有繳")}
          {chip("noFileNo", "還沒有檔號")}
        </div>
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <section aria-label="農民清單" className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="tabular w-full min-w-[640px] whitespace-nowrap text-[15px]">
              <thead>
                <tr className="border-b border-line bg-panel text-left text-sm text-ink-2">
                  <th className="px-3 py-2.5 font-bold text-brand-700">檔號</th>
                  <th className="px-3 py-2.5 font-bold">姓名</th>
                  <th className="px-3 py-2.5 font-bold">電話</th>
                  <th className="px-3 py-2.5 font-bold">本期收購點</th>
                  <th className="px-3 py-2.5 text-right font-bold">本期公斤</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((f) => {
                  const active = f.id === selected;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => setSelected(f.id)}
                      className={`cursor-pointer border-t border-line-soft align-top ${
                        active ? "bg-brand-50 shadow-[inset_3px_0_0_#2F6F4F]" : "hover:bg-paper"
                      }`}
                    >
                      <td className={`px-3 py-2.5 font-medium ${f.fileNo ? "text-brand-700" : "text-warn-800"}`}>
                        <button type="button" className="text-left" onClick={() => setSelected(f.id)}>
                          {f.fileNo ?? "還沒有"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{f.name}</td>
                      <td className="px-3 py-2.5 text-ink-2">
                        {splitPhones(f.phone).map((p, i) => (
                          <div key={i}>{p}</div>
                        ))}
                      </td>
                      <td className="px-3 py-2.5 text-muted">{f.sites.join("、")}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(f.kg)}</td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">
                      沒有符合的農民
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 border-t border-line-soft px-3 py-2.5 text-[13px] text-muted">
            顯示 {Math.min(limit, filtered.length)} 筆，共 {filtered.length} 筆（「本期」是 {periodLabel}）
            {filtered.length > limit && (
              <button type="button" onClick={() => setLimit((n) => n + PAGE * 4)} className="ml-auto font-bold text-brand-600">
                再顯示 {Math.min(PAGE * 4, filtered.length - limit)} 筆
              </button>
            )}
          </div>
        </section>
        {selected !== null && (
          <FarmerPanel
            key={selected}
            farmer={farmer ?? null}
            latestLabel={latestLabel}
            onClose={() => setSelected(null)}
            onCreated={(id) => setSelected(id)}
          />
        )}
      </div>
    </>
  );
}

type Form = { fileNo: string; name: string; phone: string; address: string };
type Confirm = { n: number; period: string; sites: string[] };

function FarmerPanel({
  farmer,
  latestLabel,
  onClose,
  onCreated,
}: {
  farmer: FarmerRow | null;
  latestLabel: string;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const router = useRouter();
  const initial: Form = {
    fileNo: farmer?.fileNo ?? "",
    name: farmer?.name ?? "",
    phone: farmer?.phone ?? "",
    address: farmer?.address ?? "",
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [history, setHistory] = useState<FarmerHistoryItem[] | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setConfirm(null);
    setNotice(null);
  };

  useEffect(() => {
    if (!farmer) return;
    let alive = true;
    getFarmerHistory(farmer.id).then((r) => alive && setHistory(r.ok ? r.data : []));
    return () => {
      alive = false;
    };
  }, [farmer]);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
  };

  const apply = (applyToCurrent: boolean) =>
    run(async () => {
      if (!farmer) return null;
      const r = await updateFarmer(farmer.id, form, applyToCurrent);
      if (!r.ok) return r.error;
      setConfirm(null);
      setNotice(r.data.updatedRecords ? `已儲存，${latestLabel}的 ${r.data.updatedRecords} 筆紀錄也一起更新了` : "已儲存（只改名冊）");
      router.refresh();
      return null;
    });

  const save = async () => {
    if (!farmer) {
      return run(async () => {
        const r = await createFarmer(form);
        if (!r.ok) return r.error;
        router.refresh();
        onCreated(r.data.id);
        return null;
      });
    }
    // 作業中那一期有用到這位農民的紀錄 → 先問要不要一起更新
    setBusy(true);
    const c = await countCurrentRecords(farmer.id);
    setBusy(false);
    if (!c.ok) return setError(c.error);
    if (c.data.n > 0) return setConfirm(c.data);
    return apply(false);
  };

  const label = "flex flex-col gap-1.5 text-[13px] text-muted";
  const input = "h-11 rounded-[10px] border border-field bg-white px-3 text-[15px] text-ink focus:border-brand-600 focus:outline-none";
  const changedWhat = (["phone", "name", "address", "fileNo"] as const)
    .filter((k) => form[k] !== initial[k])
    .map((k) => ({ phone: "電話", name: "姓名", address: "地址", fileNo: "檔號" })[k]);

  return (
    <aside aria-label="農民資料" className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-line bg-white p-5 xl:w-[400px]">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{farmer ? farmer.name : "新增農民"}</h2>
        {farmer?.fileNo && <span className="text-sm font-medium text-brand-700">{farmer.fileNo}</span>}
        <button type="button" onClick={onClose} aria-label="關閉" className="size-9 rounded-lg text-xl text-muted hover:bg-paper">
          ×
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={`${label} font-bold !text-brand-700`}>
          檔號
          <input className={`${input} font-normal`} value={form.fileNo} placeholder="Q11101404" onChange={set("fileNo")} />
        </label>
        <label className={label}>
          姓名
          <input className={input} value={form.name} onChange={set("name")} />
        </label>
      </div>
      <label className={label}>
        電話（好幾支用 / 分開）
        <input className={input} inputMode="tel" value={form.phone} onChange={set("phone")} />
      </label>
      <label className={label}>
        地址
        <input className={input} value={form.address} placeholder="還沒填" onChange={set("address")} />
      </label>

      {confirm && (
        <div role="alertdialog" aria-label="也要更新本期的紀錄嗎" className="flex flex-col gap-2 rounded-xl border border-warn-line bg-warn-50 p-4">
          <div className="font-bold">{changedWhat.join("、")}改了，也要更新本期的紀錄嗎？</div>
          <div className="text-sm text-ink-2">
            {confirm.period}有 {confirm.n} 筆用到{initial.name}（{confirm.sites.join("、")}）。更新後週報表備註、收款單也會用新資料。
          </div>
          <div className="text-sm text-muted">過去期別的紀錄保留當時的資料，不會改。</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => apply(true)}
              className="h-10 rounded-[10px] bg-brand-600 px-4 font-bold text-white disabled:opacity-50"
            >
              更新本期 {confirm.n} 筆
            </button>
            <button type="button" disabled={busy} onClick={() => apply(false)} className="h-10 rounded-[10px] border border-field bg-white px-4">
              只改名冊
            </button>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && !dirty && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{notice}</p>}

      {!confirm && (
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={save}
            className="h-11 flex-1 rounded-[10px] bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? "儲存中…" : farmer ? "儲存" : "新增"}
          </button>
          <button
            type="button"
            onClick={() => (dirty ? setForm(initial) : onClose())}
            className="h-11 rounded-[10px] border border-field px-4"
          >
            {dirty ? "取消修改" : "關閉"}
          </button>
        </div>
      )}

      {farmer && (
        <div className="border-t border-line-soft pt-4">
          <div className="mb-2 text-sm font-bold">繳穀紀錄</div>
          {history === null ? (
            <p className="text-sm text-muted">讀取中…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted">還沒有公糧紀錄</p>
          ) : (
            <table className="tabular w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1 font-medium">期別</th>
                  <th className="py-1 font-medium">收購點</th>
                  <th className="py-1 text-right font-medium">公斤</th>
                  <th className="py-1 text-right font-medium">收</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.recordId} className="border-t border-line-soft">
                    <td className="py-1.5">{h.period}</td>
                    <td className="py-1.5">{h.site}</td>
                    <td className="py-1.5 text-right">{fmt(h.kg)}</td>
                    <td className="py-1.5 text-right font-bold text-brand-700">{h.collect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted">匯入舊期別的公糧 Excel 後，這裡會列出每一期。</p>
        </div>
      )}
    </aside>
  );
}

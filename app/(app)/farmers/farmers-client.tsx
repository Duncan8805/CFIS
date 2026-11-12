"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { SAVE_FAILED_MESSAGE } from "@/components/use-record-saver";
import { DISCARD_CONFIRM, useUnsavedGuard } from "@/components/use-unsaved-guard";

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
  // 右邊的編輯欄有改過還沒存：換一位農民前先問，免得打的字不見
  const panelDirty = useRef(false);
  const choose = (next: number | "new") => {
    if (next === selected) return;
    if (panelDirty.current && !confirm(DISCARD_CONFIRM)) return;
    panelDirty.current = false;
    setSelected(next);
  };

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
      className={`min-h-11 whitespace-nowrap rounded-[4px] border px-3.5 text-[15px] ${
        filter === key ? "border-brand-600 bg-brand-600 font-bold text-white" : "border-field bg-white text-ink-2 hover:border-brand-600"
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
          <button type="button" onClick={() => choose("new")} className={buttonClass.primary}>
            ＋ 新增農民
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[4px] border border-field bg-white px-3 text-muted focus-within:border-brand-600 sm:max-w-sm">
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
            className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ghost"
          />
        </label>
        <div role="group" aria-label="篩選" className="flex flex-wrap gap-2">
          {chip("all", "全部")}
          {chip("current", "本期有繳")}
          {chip("noFileNo", "還沒有檔號")}
        </div>
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <section aria-label="農民清單" className="min-w-0 flex-1 overflow-hidden rounded-[4px] border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse whitespace-nowrap text-[15px] [&_td]:border [&_td]:border-line-soft [&_th]:border [&_th]:border-line-soft">
              <thead>
                <tr className="border-b-2 border-line bg-head text-left text-[15px] text-ink-2">
                  <th className="px-2.5 py-2 font-bold text-brand-700">檔號</th>
                  <th className="px-2.5 py-2 font-bold">姓名</th>
                  <th className="px-2.5 py-2 font-bold">電話</th>
                  <th className="px-2.5 py-2 font-bold">本期收購點</th>
                  <th className="px-2.5 py-2 text-right font-bold">本期公斤</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((f) => {
                  const active = f.id === selected;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => choose(f.id)}
                      className={`cursor-pointer align-top ${
                        active ? "bg-brand-50 font-bold outline outline-1 -outline-offset-1 outline-brand-600" : "hover:bg-paper"
                      }`}
                    >
                      <td className={`px-2.5 py-1 font-medium ${f.fileNo ? "tabular text-brand-700" : "text-warn-800"}`}>
                        <button type="button" className="min-h-9 text-left underline-offset-4 hover:underline" onClick={() => choose(f.id)}>
                          {f.fileNo ?? "還沒有"}
                        </button>
                      </td>
                      <td className="px-2.5 py-2 font-medium">{f.name}</td>
                      <td className="tabular px-2.5 py-2 text-ink-2">
                        {splitPhones(f.phone).map((p, i) => (
                          <div key={i}>{p}</div>
                        ))}
                      </td>
                      <td className="px-2.5 py-2 text-ink-2">{f.sites.join("、")}</td>
                      <td className="tabular px-2.5 py-2 text-right">{fmt(f.kg)}</td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[15px] text-muted">
                      沒有符合的農民
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-head px-3 py-1.5 text-[14px] text-ink-2">
            顯示 {Math.min(limit, filtered.length)} 筆，共 {filtered.length} 筆（「本期」是 {periodLabel}）
            {filtered.length > limit && (
              <button type="button" onClick={() => setLimit((n) => n + PAGE * 4)} className="ml-auto min-h-11 rounded-[4px] px-2 font-bold text-brand-600 hover:bg-brand-50">
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
            onClose={() => {
              panelDirty.current = false;
              setSelected(null);
            }}
            onCreated={(id) => {
              panelDirty.current = false;
              setSelected(id);
            }}
            onDirtyChange={(d) => (panelDirty.current = d)}
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
  onDirtyChange,
}: {
  farmer: FarmerRow | null;
  latestLabel: string;
  onClose: () => void;
  onCreated: (id: number) => void;
  /** 有沒有改過還沒存（換農民前要先問） */
  onDirtyChange: (dirty: boolean) => void;
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
  useUnsavedGuard(dirty || busy);
  useEffect(() => onDirtyChange(dirty || busy), [dirty, busy, onDirtyChange]);
  /** 右上角 ×：有改過要先問 */
  const requestClose = () => {
    if (!(dirty || busy) || window.confirm(DISCARD_CONFIRM)) onClose();
  };
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
    let err: string | null;
    try {
      err = await fn();
    } catch {
      // 網路斷了：打的字留著，可以再按一次儲存
      err = SAVE_FAILED_MESSAGE;
    } finally {
      setBusy(false);
    }
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
    const c = await countCurrentRecords(farmer.id).catch(() => ({ ok: false as const, error: SAVE_FAILED_MESSAGE }));
    setBusy(false);
    if (!c.ok) return setError(c.error);
    if (c.data.n > 0) return setConfirm(c.data);
    return apply(false);
  };

  const label = "flex flex-col gap-1.5 text-[14px] text-ink-2";
  const input = "h-11 rounded-[4px] border border-field bg-white px-3 text-[16px] text-ink placeholder:text-ghost focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30";
  const changedWhat = (["phone", "name", "address", "fileNo"] as const)
    .filter((k) => form[k] !== initial[k])
    .map((k) => ({ phone: "電話", name: "姓名", address: "地址", fileNo: "檔號" })[k]);

  return (
    <aside aria-label="農民資料" className="flex w-full shrink-0 flex-col gap-4 rounded-[4px] border border-line bg-white p-4 xl:w-[400px]">
      <div className="-mx-4 -mt-4 flex items-center gap-2 border-b border-line bg-head px-4 py-1.5">
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-bold">{farmer ? farmer.name : "新增農民"}</h2>
        {farmer?.fileNo && <span className="tabular text-[14px] font-medium text-brand-700">{farmer.fileNo}</span>}
        <button type="button" onClick={requestClose} className="inline-flex min-h-11 shrink-0 items-center rounded-[4px] border border-field bg-white px-3 text-[15px] text-ink hover:border-brand-600">
          關閉
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
        <div role="alertdialog" aria-label="也要更新本期的紀錄嗎" className="flex flex-col gap-2 rounded-[4px] border border-warn-500 bg-warn-50 p-4">
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
              className="min-h-11 rounded-[4px] bg-brand-600 px-4 text-[15px] font-bold text-white disabled:opacity-50"
            >
              更新本期 {confirm.n} 筆
            </button>
            <button type="button" disabled={busy} onClick={() => apply(false)} className="min-h-11 rounded-[4px] border border-field bg-white px-4 text-[15px]">
              只改名冊
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="rounded-[4px] border border-red-700 bg-red-50 px-3 py-2 text-[15px] text-red-800">{error}</p>}
      {notice && !dirty && <p className="rounded-[4px] border border-brand-200 bg-brand-50 px-3 py-2 text-[15px] text-brand-700">{notice}</p>}

      {!confirm && (
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={save}
            className="min-h-11 flex-1 rounded-[4px] bg-brand-600 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? "儲存中…" : farmer ? "儲存" : "新增"}
          </button>
          <button
            type="button"
            onClick={() => (dirty ? setForm(initial) : onClose())}
            className="min-h-11 rounded-[4px] border border-field bg-white px-4 text-[15px]"
          >
            {dirty ? "取消修改" : "關閉"}
          </button>
        </div>
      )}

      {farmer && (
        <div className="border-t border-line-soft pt-4">
          <div className="mb-2 text-[15px] font-bold">繳穀紀錄</div>
          {history === null ? (
            <p className="text-sm text-muted">讀取中…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted">還沒有公糧紀錄</p>
          ) : (
            <table className="w-full border-collapse whitespace-nowrap text-[15px] [&_td]:border [&_td]:border-line-soft [&_td]:px-2 [&_th]:border [&_th]:border-line-soft [&_th]:px-2">
              <thead>
                <tr className="bg-head text-left text-ink-2">
                  <th className="py-1 font-medium">期別</th>
                  <th className="py-1 font-medium">收購點</th>
                  <th className="py-1 text-right font-medium">公斤</th>
                  <th className="py-1 text-right font-medium">收</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.recordId}>
                    <td className="py-1.5">{h.period}</td>
                    <td className="py-1.5">{h.site}</td>
                    <td className="tabular py-1.5 text-right">{fmt(h.kg)}</td>
                    <td className="tabular py-1.5 text-right font-bold text-brand-700">{h.collect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[14px] text-muted">匯入舊期別的公糧 Excel 後，這裡會列出每一期。</p>
        </div>
      )}
    </aside>
  );
}

"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "@/components/page-header";
import { money, ReceiptSlip, type ReceiptAccount, type ReceiptData } from "./receipt-slip";

const PER_PAGE = 6;

/** 原本產生器的「略過金額為 0 的列」：入簿和收都沒有金額的不印 */
const isZero = (r: ReceiptData) => !r.deposit && !r.collect && !r.collectText;

export function ReceiptsClient({
  siteName,
  receipts,
  accounts,
}: {
  siteName: string;
  receipts: ReceiptData[];
  accounts: ReceiptAccount[];
}) {
  const [skipZero, setSkipZero] = useState(true);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [accountIds, setAccountIds] = useState<Set<number>>(new Set(accounts.map((a) => a.id)));
  const [listOpen, setListOpen] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(() => receipts.filter((r) => !(skipZero && isZero(r))), [receipts, skipZero]);
  const selected = candidates.filter((r) => !excluded.has(r.id));
  const chosenAccounts = accounts.filter((a) => accountIds.has(a.id));

  const pages: (ReceiptData | null)[][] = [];
  for (let i = 0; i < selected.length; i += PER_PAGE) {
    pages.push(Array.from({ length: PER_PAGE }, (_, j) => selected[i + j] ?? null));
  }

  // 帳號那幾行比格子寬時（分部名稱特別長）自動縮小字級，跟原本的產生器一樣
  useLayoutEffect(() => {
    pagesRef.current?.querySelectorAll<HTMLElement>(".accts-front").forEach((el) => {
      el.style.fontSize = "";
      let size = 14;
      while (el.scrollWidth > el.clientWidth && size > 7) {
        size -= 0.5;
        el.style.fontSize = `${size}pt`;
      }
    });
  });

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <>
      <section className="mb-4 flex flex-col overflow-hidden rounded-[4px] border border-line bg-white text-[15px] print:hidden">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line bg-head px-3.5 py-1.5">
          <span className="font-bold">{siteName}</span>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={skipZero}
              onChange={(e) => setSkipZero(e.target.checked)}
              className="size-[22px] shrink-0 accent-brand-600"
            />
            略過金額為 0 的
          </label>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-0 border-line sm:border-l sm:pl-4">
            <span className="text-ink-2">帳號：</span>
            {accounts.map((a) => (
              <label key={a.id} className="flex min-h-11 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={accountIds.has(a.id)}
                  onChange={() => setAccountIds((s) => toggle(s, a.id))}
                  className="size-[22px] shrink-0 accent-brand-600"
                />
                {a.org}
              </label>
            ))}
            {accounts.length === 0 && <span className="font-bold text-warn-700">還沒有設定農會帳號</span>}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!selected.length}
            className={`${buttonClass.primary} ml-auto px-6`}
          >
            列印
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-3.5 py-1.5 text-ink-2">
          <span>
            要印 <span className="tabular">{selected.length}</span> 張，共 <span className="tabular">{pages.length}</span> 頁 A4
            {candidates.length < receipts.length && `（略過 ${receipts.length - candidates.length} 筆金額為 0）`}
          </span>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="min-h-11 rounded-[4px] px-2 font-bold text-brand-700 underline underline-offset-4 hover:bg-brand-50"
          >
            {listOpen ? "收起名單" : "選擇要印的農民"}
          </button>
        </div>

        {listOpen && (
          <div className="border-t border-line-soft px-3.5 py-3">
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => setExcluded(new Set())} className={buttonClass.secondary}>
                全選
              </button>
              <button
                type="button"
                onClick={() => setExcluded(new Set(candidates.map((r) => r.id)))}
                className={buttonClass.secondary}
              >
                全不選
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-x-4 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {candidates.map((r) => (
                <li key={r.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-line-soft">
                    <input
                      type="checkbox"
                      checked={!excluded.has(r.id)}
                      onChange={() => setExcluded((s) => toggle(s, r.id))}
                      className="size-[22px] shrink-0 accent-brand-600"
                    />
                    <span className="truncate">{r.name}</span>
                    <span className="tabular ml-auto text-[14px] text-muted">{r.collectText ?? money(r.collect)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {selected.length === 0 ? (
        <p className="rounded-[4px] border border-dashed border-field bg-white p-6 text-center text-[15px] text-muted print:hidden">
          {receipts.length === 0 ? "這個收購點還沒有公糧資料。" : "沒有要印的收款單。"}
        </p>
      ) : (
        // 螢幕上縮小預覽；列印時是實際大小
        <div className="-mx-4 overflow-x-auto px-4 print:m-0 print:overflow-visible print:p-0">
          <div ref={pagesRef} className="receipts origin-top-left max-md:[zoom:0.45] print:[zoom:1]">
            {pages.map((page, p) => (
              <div key={p} className="page">
                {page.map((r, i) => (r ? <ReceiptSlip key={r.id} data={r} accounts={chosenAccounts} /> : <div key={`e${i}`} className="slip empty" />))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

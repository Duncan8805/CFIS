"use client";

import { useCallback, useRef, useState } from "react";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** 送不出去（網路斷了、伺服器沒回應）時給使用者看的訊息 */
export const SAVE_FAILED_MESSAGE = "沒存到：網路可能斷了，請再按一次儲存";

/**
 * 管理一張表的資料列與存檔（公糧、週報表共用）：
 * - 先更新畫面，再送到伺服器
 * - 同一列的存檔排隊送出
 * - 還沒確認的欄位疊在伺服器回應上面，避免較早的回應把後來打的值蓋掉
 * - 失敗（含網路斷線）時只還原這次改的欄位，表格顯示的一律是真的存進去的值；
 *   使用者打的字留在格子／編輯視窗裡並標成「沒存到」，不會不見
 */
export function useRecordSaver<T extends object, P extends object>({
  initial,
  idOf,
  send,
  onError,
}: {
  initial: T[];
  idOf: (row: T) => number;
  send: (id: number, patch: P) => Promise<Result<T>>;
  onError: (message: string) => void;
}) {
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const queues = useRef(new Map<number, Promise<unknown>>());
  const pending = useRef(new Map<number, Partial<P>>());

  const markSaving = (id: number, on: boolean) =>
    setSaving((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const apply = useCallback(
    async (id: number, patch: P): Promise<string | null> => {
      const current = rowsRef.current.find((r) => idOf(r) === id);
      if (!current) return "找不到這筆資料";

      pending.current.set(id, { ...pending.current.get(id), ...patch });
      setRows((rs) => rs.map((r) => (idOf(r) === id ? { ...r, ...patch } : r)));
      markSaving(id, true);

      const run = () => send(id, patch);
      const job = (queues.current.get(id) ?? Promise.resolve()).then(run, run);
      queues.current.set(id, job);
      let result: Result<T>;
      try {
        result = await job;
      } catch {
        // 網路斷了、伺服器沒回應：當作沒存到，不要讓畫面一直停在「儲存中」
        result = { ok: false, error: SAVE_FAILED_MESSAGE };
      } finally {
        if (queues.current.get(id) === job) {
          queues.current.delete(id);
          markSaving(id, false);
        }
      }

      // 這次送出的欄位已有結果，從「未確認」移除（之後又改過的保留）
      const stillPending: Record<string, unknown> = { ...pending.current.get(id) };
      for (const [k, v] of Object.entries(patch)) if (stillPending[k] === v) delete stillPending[k];
      pending.current.set(id, stillPending as Partial<P>);

      if (!result.ok) {
        const revert = Object.fromEntries(Object.keys(patch).map((k) => [k, current[k as keyof T]]));
        setRows((rs) => rs.map((r) => (idOf(r) === id ? { ...r, ...revert, ...stillPending } : r)));
        onError(result.error);
        return result.error;
      }
      setRows((rs) => rs.map((r) => (idOf(r) === id ? { ...result.data, ...stillPending } : r)));
      return null;
    },
    [idOf, send, onError],
  );

  return { rows, setRows, rowsRef, saving, apply };
}

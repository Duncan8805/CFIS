"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// 算「有幾格沒存到」給表格上方的儲存狀態用。
// 格子自己管沒存到的狀態（見 grid-cell.tsx），這裡只負責數，不影響存檔。

type Report = (delta: 1 | -1) => void;

export const FailedCellsContext = createContext<Report | null>(null);

/** 表格那一層用：回傳目前沒存到的格數，和要包在表格外面的 report */
export function useFailedCellCount() {
  const [count, setCount] = useState(0);
  const report: Report = useCallback((delta) => setCount((c) => Math.max(0, c + delta)), []);
  return { count, report };
}

/** 格子用：沒存到時算一格，存好或格子消失時扣回來 */
export function useReportFailed(failed: boolean) {
  const report = useContext(FailedCellsContext);
  useEffect(() => {
    if (!failed || !report) return;
    report(1);
    return () => report(-1);
  }, [failed, report]);
}

"use client";

import { useEffect } from "react";

/** 編輯視窗有改過、還沒存時，按取消／Esc 要先問 */
export const DISCARD_CONFIRM = "還沒儲存，確定不要這些修改嗎？";

/**
 * 有還沒存好的資料（正在存、沒存到、或打了字還沒存）時，關分頁或重新整理會先跳出瀏覽器的提醒。
 * 資料都存好了就拿掉，不打擾。
 */
export function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 舊版瀏覽器要設 returnValue 才會跳提醒
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 記在這台電腦上的開關（例如選單收合）。讀不到瀏覽器儲存空間時（無痕模式等）就用預設值，只是不會記住。
 */
export function usePersistedToggle(key: string, initial: boolean) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) setValue(saved === "1");
    } catch {}
  }, [key]);

  const toggle = useCallback(() => {
    setValue((v) => {
      try {
        localStorage.setItem(key, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }, [key]);

  return [value, toggle] as const;
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// 像 Excel 的可編輯格子（公糧表、週報表共用）。
// 方向鍵移動、Enter 往下、Shift+Enter 往上、Esc 取消；離開格子才存檔，而且只有真的打過字才算修改。

export function focusCell(gridId: string, r: number, c: number) {
  const el = document.querySelector<HTMLInputElement>(`[data-grid="${gridId}"] input[data-r="${r}"][data-c="${c}"]`);
  if (el) {
    el.focus();
    el.select();
  }
  return !!el;
}

export function GridCell({
  gridId,
  row,
  col,
  value,
  placeholder,
  numeric,
  list,
  label,
  highlight,
  onCommit,
}: {
  gridId: string;
  row: number;
  col: number;
  value: string;
  placeholder?: string;
  numeric?: boolean;
  list?: string;
  label: string;
  /** 例如 收 欄被手動改成「扣」 */
  highlight?: boolean;
  onCommit: (raw: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(value);
  // 游標只是經過（例如畫面剛帶出電話、還沒更新到這格）不算修改
  const dirty = useRef(false);

  // 資料從伺服器更新後同步；正在打字的格子不動
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  const commit = () => {
    if (!dirty.current) return;
    dirty.current = false;
    if (draft === value) return;
    onCommit(draft).then((err) => {
      if (err) setDraft(value);
    });
  };

  const move = (dr: number, dc: number) => {
    commit();
    focusCell(gridId, row + dr, col + dc);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    if (e.key === "Enter") {
      e.preventDefault();
      move(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1, 0);
    } else if (e.key === "ArrowLeft" && atStart) {
      e.preventDefault();
      move(0, -1);
    } else if (e.key === "ArrowRight" && atEnd) {
      e.preventDefault();
      move(0, 1);
    } else if (e.key === "Escape") {
      dirty.current = false;
      setDraft(value);
    }
  };

  return (
    <input
      data-r={row}
      data-c={col}
      aria-label={label}
      value={draft}
      list={list}
      placeholder={placeholder}
      inputMode={numeric ? "decimal" : undefined}
      onChange={(e) => {
        dirty.current = true;
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={`w-full bg-transparent px-2 py-1.5 outline-none placeholder:text-inherit focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-500 ${
        numeric ? "text-right" : ""
      } ${highlight ? "font-bold text-amber-700" : ""}`}
    />
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useReportFailed } from "./failed-cells";
import { SAVE_FAILED_MESSAGE } from "./use-record-saver";
import { useUnsavedGuard } from "./use-unsaved-guard";

// 像 Excel 的可編輯格子（公糧表、週報表共用）。
// 方向鍵移動、Enter 往下、Shift+Enter 往上、Esc 取消；離開格子才存檔，而且只有真的打過字才算修改。
// 沒存到（打錯格式、網路斷了）時，打的字留在格子裡、加粗紅框；改好再離開格子就會重存，按 Esc 恢復原本存的值。

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
  display,
  onPastEnd,
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
  /**
   * 沒在編輯時改顯示這個內容（例如電話一支一行、姓名不換行），由它決定格子的寬高；
   * 點進去才看到原本的輸入框。
   */
  display?: ReactNode;
  /** 在最後一列按 Enter／往下時呼叫（例如新增一筆） */
  onPastEnd?: () => void;
  onCommit: (raw: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(value);
  // 游標只是經過（例如畫面剛帶出電話、還沒更新到這格）不算修改
  const dirty = useRef(false);
  // 打了字還沒存（用來在關分頁時提醒）
  const [typed, setTyped] = useState(false);
  // 沒存到的原因；有值時格子保留使用者打的字
  const [error, setError] = useState<string | null>(null);
  // 同上，給 commit 立即判斷用（按 Enter 會連續觸發 commit 和 blur，state 還沒更新）
  const failed = useRef(false);
  useUnsavedGuard(typed || error !== null);
  // 表格上方的「有 N 格沒存到」
  useReportFailed(error !== null);

  // 資料從伺服器更新後同步；正在打字、或沒存到的格子不動
  useEffect(() => {
    if (!dirty.current && error === null) setDraft(value);
  }, [value, error]);

  const commit = () => {
    if (!dirty.current && !failed.current) return;
    dirty.current = false;
    failed.current = false;
    setTyped(false);
    if (draft === value) {
      setError(null);
      return;
    }
    const sent = draft;
    const done = (err: string | null) => {
      if (err) {
        failed.current = true;
        setError(err);
        // 表格那一列已還原成存進去的值；格子裡放回使用者打的字（之後又打了新的就不動）
        if (!dirty.current) setDraft(sent);
      } else {
        setError(null);
      }
    };
    onCommit(sent).then(done, () => done(SAVE_FAILED_MESSAGE));
  };

  const move = (dr: number, dc: number) => {
    commit();
    if (!focusCell(gridId, row + dr, col + dc) && dr > 0 && onPastEnd) onPastEnd();
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
      failed.current = false;
      setTyped(false);
      setError(null);
      setDraft(value);
    }
  };

  const input = (
    <input
      data-r={row}
      data-c={col}
      aria-label={label}
      aria-invalid={error !== null ? true : undefined}
      title={error ?? undefined}
      value={draft}
      list={list}
      placeholder={placeholder}
      inputMode={numeric ? "decimal" : undefined}
      onChange={(e) => {
        dirty.current = true;
        setTyped(true);
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={`min-h-10 w-full px-2 py-2 outline-none placeholder:text-ghost focus:bg-white ${
        error !== null
          ? "bg-red-50 ring-[3px] ring-inset ring-red-700"
          : "bg-transparent focus:ring-2 focus:ring-inset focus:ring-brand-600"
      } ${
        numeric ? "text-right" : ""
      } ${highlight ? "font-bold text-warn-700" : ""} ${
        display !== undefined ? "absolute inset-0 h-full text-transparent placeholder:text-transparent focus:text-ink focus:placeholder:text-ghost" : ""
      }`}
    />
  );
  if (display === undefined) return input;
  return (
    <div className="relative">
      {/* 正在打字時顯示草稿，避免切換前後內容不同 */}
      <div aria-hidden="true" className="min-h-10 whitespace-nowrap px-2 py-2">
        {dirty.current || error !== null ? draft || " " : display}
      </div>
      {input}
    </div>
  );
}

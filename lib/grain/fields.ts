// 公糧表的欄位定義與輸入解析。前端（即時驗證）與 server action（再驗證一次）共用。

import type { RoundingMode } from "@/lib/calc";

export interface GrainRecordDto {
  id: number;
  seq: number;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  kg: number | null;
  fen: number | null;
  deposit: number | null;
  collectOverride: string | null;
  roundingMode: RoundingMode | null;
}

export interface GrainPatch {
  code?: string | null;
  name?: string;
  phone?: string | null;
  address?: string | null;
  kg?: number | null;
  fen?: number | null;
  deposit?: number | null;
  collectOverride?: string | null;
}

/** 可以編輯的欄位，順序就是表格的欄位順序（利、運費、先付 夾在中間，是計算欄） */
export type EditableField = "code" | "name" | "phone" | "kg" | "fen" | "deposit" | "collect" | "address";

export const FIELD_LABEL: Record<EditableField, string> = {
  code: "編號",
  name: "姓名",
  phone: "電話",
  kg: "公斤",
  fen: "分",
  deposit: "入簿",
  collect: "收",
  address: "地址",
};

const MAX_LEN: Partial<Record<EditableField, number>> = { code: 20, name: 32, phone: 100, address: 200, collect: 20 };

export type ParseResult = { ok: true; patch: GrainPatch } | { ok: false; error: string };

function parseNumber(raw: string): number | null | "invalid" {
  const s = raw.replace(/[,\s]/g, "");
  if (s === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return "invalid";
  return Number(s);
}

/** 把使用者在某一格輸入的文字，轉成要存進資料庫的欄位 */
export function parseField(field: EditableField, raw: string): ParseResult {
  const text = raw.trim();
  const max = MAX_LEN[field];
  if (max && text.length > max) return { ok: false, error: `${FIELD_LABEL[field]}最多 ${max} 個字` };

  switch (field) {
    case "code":
    case "phone":
    case "address":
      return { ok: true, patch: { [field]: text || null } };
    case "name":
      return { ok: true, patch: { name: text } };
    case "collect": {
      // 收 是計算欄；只能填文字（扣、5/24扣），清空就恢復自動計算
      if (text && parseNumber(text) !== "invalid") {
        return { ok: false, error: "收會自動計算，這格只能填文字（例如：扣），清空就恢復計算" };
      }
      return { ok: true, patch: { collectOverride: text || null } };
    }
    case "kg":
    case "deposit": {
      const n = parseNumber(text);
      if (n === "invalid" || (n !== null && !Number.isInteger(n))) {
        return { ok: false, error: `${FIELD_LABEL[field]}要填整數` };
      }
      if (field === "kg" && n !== null && n < 0) return { ok: false, error: "公斤不能是負數" };
      return { ok: true, patch: { [field]: n } };
    }
    case "fen": {
      const n = parseNumber(text);
      if (n === "invalid" || (n !== null && n < 0)) return { ok: false, error: "分要填數字" };
      if (n !== null && Math.round(n * 10000) / 10000 !== n) return { ok: false, error: "分最多 4 位小數" };
      return { ok: true, patch: { fen: n } };
    }
  }
}

/** 某一格目前要顯示在輸入框裡的文字 */
export function fieldText(record: GrainRecordDto, field: EditableField): string {
  switch (field) {
    case "collect":
      return record.collectOverride ?? "";
    case "kg":
    case "fen":
    case "deposit": {
      const v = record[field];
      return v === null ? "" : String(v);
    }
    default:
      return record[field] ?? "";
  }
}

// 公糧表的欄位定義與輸入解析。前端（即時驗證）與 server action（再驗證一次）共用。

import type { RoundingMode } from "@/lib/calc";
import { toHalfWidth } from "@/lib/text/halfwidth";

export interface GrainRecordDto {
  id: number;
  seq: number;
  farmerId: number | null;
  fileNo: string | null;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  kg: number | null;
  planKg: number | null;
  guideKg: number | null;
  fen: number | null;
  deposit: number | null;
  collectOverride: string | null;
  roundingMode: RoundingMode | null;
}

export interface GrainPatch {
  fileNo?: string | null;
  code?: string | null;
  name?: string;
  phone?: string | null;
  address?: string | null;
  planKg?: number | null;
  guideKg?: number | null;
  fen?: number | null;
  deposit?: number | null;
  collectOverride?: string | null;
}

/** 可以編輯的欄位。公斤＝計畫＋輔導，不能直接打。 */
export type EditableField =
  | "fileNo"
  | "code"
  | "name"
  | "phone"
  | "fen"
  | "plan"
  | "guide"
  | "deposit"
  | "collect"
  | "address";

export const FIELD_LABEL: Record<EditableField, string> = {
  fileNo: "檔號",
  code: "編號",
  name: "姓名",
  phone: "電話",
  fen: "分",
  plan: "計畫收購",
  guide: "輔導收購",
  deposit: "入簿",
  collect: "收",
  address: "地址",
};

const MAX_LEN: Partial<Record<EditableField, number>> = { code: 20, name: 32, phone: 100, address: 200, collect: 20 };

/** 檔號：1 個英文字母加 8 位數字，例如 Q11101404 */
export const FILE_NO_PATTERN = /^[A-Z]\d{8}$/;

export type ParseResult = { ok: true; patch: GrainPatch } | { ok: false; error: string };

function parseNumber(raw: string): number | null | "invalid" {
  // 中文輸入法的全形數字（１，２３４、－３００）先轉半形
  const s = toHalfWidth(raw).replace(/[,\s]/g, "");
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
    case "fileNo": {
      const v = toHalfWidth(text).replace(/\s/g, "").toUpperCase();
      if (v && !FILE_NO_PATTERN.test(v)) return { ok: false, error: "檔號是 1 個英文字母加 8 位數字，例如 Q11101404" };
      return { ok: true, patch: { fileNo: v || null } };
    }
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
    case "plan":
    case "guide":
    case "deposit": {
      const n = parseNumber(text);
      if (n === "invalid" || (n !== null && !Number.isInteger(n))) {
        return { ok: false, error: `${FIELD_LABEL[field]}要填整數` };
      }
      if (field !== "deposit" && n !== null && n < 0) return { ok: false, error: `${FIELD_LABEL[field]}不能是負數` };
      const key = field === "plan" ? "planKg" : field === "guide" ? "guideKg" : "deposit";
      return { ok: true, patch: { [key]: n } };
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
    case "plan":
    case "guide":
    case "fen":
    case "deposit": {
      const v = field === "plan" ? record.planKg : field === "guide" ? record.guideKg : record[field];
      return v === null ? "" : String(v);
    }
    default:
      return record[field] ?? "";
  }
}

/**
 * 公斤 = 計畫收購 + 輔導收購（餘糧收購不算）。
 * 兩欄都空白時沿用原本的公斤：從舊 Excel 匯入的資料只有公斤。
 */
export function totalKg(planKg: number | null, guideKg: number | null, previousKg: number | null): number | null {
  if (planKg === null && guideKg === null) return previousKg;
  return (planKg ?? 0) + (guideKg ?? 0);
}

/** 打了核定面積（分，公頃）時，依這一期每公頃的收購量算出建議的計畫、輔導數量（四捨五入到公斤） */
export function suggestPlanGuide(
  fen: number,
  planKgPerHa: number | null,
  guideKgPerHa: number | null,
): { planKg?: number; guideKg?: number } {
  const scaled = Math.round(fen * 10000);
  const kg = (perHa: number) => Math.round((scaled * perHa) / 10000);
  return {
    ...(planKgPerHa ? { planKg: kg(planKgPerHa) } : {}),
    ...(guideKgPerHa ? { guideKg: kg(guideKgPerHa) } : {}),
  };
}

/** 電話欄常把好幾支寫在一起（用「/」或換行分開），顯示時一支一行 */
export function splitPhones(phone: string | null): string[] {
  if (!phone) return [];
  return phone
    .split(/[\/\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

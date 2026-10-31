// 週報表的欄位、日期格式與輸入解析。前端與 server action 共用。

export interface WeeklyRowDto {
  entryId: number;
  grainId: number;
  seq: number;
  /** 以下三個從公糧帶入，週報表不能改 */
  name: string;
  kg: number | null;
  phone: string | null;
  intakeDate: string | null;
  moisture: number | null;
  plannedSellDate: string | null;
  sellToOverride: string | null;
  remarkOverride: string | null;
}

export interface WeeklyPatch {
  intakeDate?: string | null;
  moisture?: number | null;
  plannedSellDate?: string | null;
  sellToOverride?: string | null;
  remarkOverride?: string | null;
}

export type WeeklyField = "intakeDate" | "moisture" | "sellTo" | "plannedSellDate" | "remark";

export const WEEKLY_LABEL: Record<WeeklyField, string> = {
  intakeDate: "濕穀進儲日期",
  moisture: "水分",
  sellTo: "預計繳售公糧業者名稱",
  plannedSellDate: "預定繳售日期",
  remark: "備註",
};

/** YYYY-MM-DD → 6月28日（跟 Excel 的 m"月"d"日" 一樣，不顯示年） */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${m}月${d}日`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 解析使用者輸入的日期。接受 6/28、6-28、6月28日、0628、2026-06-28、115/6/28。
 * 沒寫年份時用期別的西元年。
 */
export function parseDate(text: string, defaultYear: number): string | null | "invalid" {
  const s = text.trim().replace(/日$/, "");
  if (!s) return null;
  let y = defaultYear;
  let m: number;
  let d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{2,4})[-/.年](\d{1,2})[-/.月](\d{1,2})$/))) {
    y = Number(match[1]);
    if (y < 1000) y += 1911; // 民國年
    m = Number(match[2]);
    d = Number(match[3]);
  } else if ((match = s.match(/^(\d{1,2})[-/.月](\d{1,2})$/))) {
    m = Number(match[1]);
    d = Number(match[2]);
  } else if ((match = s.match(/^(\d{2})(\d{2})$/))) {
    m = Number(match[1]);
    d = Number(match[2]);
  } else {
    return "invalid";
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "invalid";
  return `${y}-${pad(m)}-${pad(d)}`;
}

export interface WeeklyDefaults {
  /** 期別的西元年，日期沒寫年時用 */
  year: number;
  /** 收購點預設的繳售業者 */
  sellTo: string;
  /** 依收購點規則算出的預設備註（農民電話或代收人電話） */
  remark: string;
}

export type WeeklyParseResult = { ok: true; patch: WeeklyPatch } | { ok: false; error: string };

export function parseWeeklyField(field: WeeklyField, raw: string, defaults: WeeklyDefaults): WeeklyParseResult {
  const text = raw.trim();
  switch (field) {
    case "intakeDate":
    case "plannedSellDate": {
      const v = parseDate(text, defaults.year);
      if (v === "invalid") return { ok: false, error: "日期看不懂，請輸入像 6/28 這樣的格式" };
      return { ok: true, patch: { [field]: v } };
    }
    case "moisture": {
      if (!text) return { ok: true, patch: { moisture: null } };
      if (!/^\d{1,3}$/.test(text) || Number(text) > 100) return { ok: false, error: "水分要填 0–100 的整數" };
      return { ok: true, patch: { moisture: Number(text) } };
    }
    case "sellTo":
      if (text.length > 32) return { ok: false, error: "繳售業者最多 32 個字" };
      // 跟收購點預設一樣就不另外存，之後改收購點設定會跟著變
      return { ok: true, patch: { sellToOverride: text === defaults.sellTo || !text ? null : text } };
    case "remark":
      if (text.length > 100) return { ok: false, error: "備註最多 100 個字" };
      return { ok: true, patch: { remarkOverride: text === defaults.remark ? null : text } };
  }
}

export function weeklyFieldText(row: WeeklyRowDto, field: WeeklyField, defaults: WeeklyDefaults): string {
  switch (field) {
    case "intakeDate":
    case "plannedSellDate":
      return formatDate(row[field]);
    case "moisture":
      return row.moisture === null ? "" : String(row.moisture);
    case "sellTo":
      return row.sellToOverride ?? defaults.sellTo;
    case "remark":
      return row.remarkOverride ?? defaults.remark;
  }
}

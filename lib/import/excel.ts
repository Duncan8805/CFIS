import type { CellValue, Workbook, Worksheet } from "exceljs";

// 把公糧 Excel 與週報表 Excel 讀成單純的資料列。
// 只讀資料，不做判斷；配對與檢查在 plan.ts。

export interface GrainRow {
  sheet: string;
  /** Excel 列號，回報問題時用 */
  row: number;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  kg: number | null;
  fen: number | null;
  deposit: number | null;
  /** 收 欄是文字時（扣、5/24扣） */
  collectOverride: string | null;
  /** Excel 上算出來的值，用來驗證捨入規則 */
  excel: { interest: number | null; freight: number | null; prepaid: number | null; collect: number | null };
}

export interface WeeklyRow {
  sheet: string;
  row: number;
  /** YYYY-MM-DD */
  intakeDate: string | null;
  name: string;
  kg: number | null;
  moisture: number | null;
  sellTo: string | null;
  plannedSellDate: string | null;
  remark: string | null;
}

const SUBTOTAL_NAMES = new Set(["本頁小計", "小計", "總合計", "合計"]);
const SKIP_WEEKLY_SHEETS = new Set(["濕稻穀折算率Data"]);

/** 取出儲存格的實際值：公式取計算結果，rich text 串成文字 */
export function plainValue(value: CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if ("result" in value) return plainValue(value.result as CellValue);
  if ("richText" in value) return value.richText.map((t) => t.text).join("");
  if ("text" in value && typeof value.text === "string") return value.text;
  return null; // 沒有結果的公式、錯誤值
}

export function asText(value: CellValue): string | null {
  const v = plainValue(value);
  if (v === null || v === "") return null;
  const text = v instanceof Date ? toIsoDate(v) : String(v);
  return text.trim() || null;
}

export function asNumber(value: CellValue): number | null {
  const v = plainValue(value);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v.replace(/,/g, "")))) {
    return Number(v.replace(/,/g, ""));
  }
  return null;
}

/** Excel 日期沒有時區；ExcelJS 以 UTC 午夜表示，所以取 UTC 的年月日 */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function asDate(value: CellValue): string | null {
  const v = plainValue(value);
  if (v instanceof Date) return toIsoDate(v);
  if (typeof v === "number" && v > 30000 && v < 80000) {
    // Excel 序號日期（1900 系統）
    return toIsoDate(new Date(Date.UTC(1899, 11, 30) + v * 86400000));
  }
  return null;
}

const normalizeHeader = (text: string | null) => (text ?? "").replace(/\s+/g, "");

/** 在前 10 列找同時包含所有關鍵字的標題列，回傳 列號 與 標題→欄號 對照 */
function findHeader(ws: Worksheet, required: string[]): { row: number; cols: Map<string, number> } | null {
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const cols = new Map<string, number>();
    ws.getRow(r).eachCell((cell, col) => {
      const h = normalizeHeader(asText(cell.value));
      if (h && !cols.has(h)) cols.set(h, col);
    });
    if (required.every((k) => [...cols.keys()].some((h) => h.startsWith(k)))) return { row: r, cols };
  }
  return null;
}

function colOf(cols: Map<string, number>, prefix: string): number | null {
  for (const [h, c] of cols) if (h.startsWith(prefix)) return c;
  return null;
}

export function parseGrainWorkbook(wb: Workbook): { rows: GrainRow[]; sheets: string[]; skipped: string[] } {
  const rows: GrainRow[] = [];
  const sheets: string[] = [];
  const skipped: string[] = [];

  for (const ws of wb.worksheets) {
    const sheet = ws.name.trim();
    const header = sheet.startsWith("範例") ? null : findHeader(ws, ["編號", "公斤"]);
    if (!header) {
      skipped.push(sheet);
      continue;
    }
    sheets.push(sheet);
    const c = header.cols;
    const codeCol = colOf(c, "編號");
    // 「朴子」那張的標題列少了「姓名」，姓名在編號的下一欄
    const nameCol = colOf(c, "姓名") ?? (codeCol ?? 1) + 1;
    const col = (k: string) => colOf(c, k);

    for (let r = header.row + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (k: number | null) => (k ? row.getCell(k).value : null);
      const name = asText(get(nameCol));
      if (!name || SUBTOTAL_NAMES.has(name)) continue;
      const collectRaw = plainValue(get(col("收")));
      rows.push({
        sheet,
        row: r,
        code: asText(get(codeCol)),
        name,
        phone: asText(get(col("電話"))),
        address: asText(get(col("地址"))),
        kg: asNumber(get(col("公斤"))),
        fen: asNumber(get(col("分"))),
        deposit: asNumber(get(col("入簿"))),
        collectOverride: typeof collectRaw === "string" && collectRaw.trim() ? collectRaw.trim() : null,
        excel: {
          interest: asNumber(get(col("利"))),
          freight: asNumber(get(col("運費"))),
          prepaid: asNumber(get(col("先付"))),
          collect: typeof collectRaw === "number" ? collectRaw : null,
        },
      });
    }
  }
  return { rows, sheets, skipped };
}

export function parseWeeklyWorkbook(wb: Workbook): { rows: WeeklyRow[]; sheets: string[]; skipped: string[] } {
  const rows: WeeklyRow[] = [];
  const sheets: string[] = [];
  const skipped: string[] = [];

  for (const ws of wb.worksheets) {
    const sheet = ws.name.trim();
    const header =
      sheet.includes("範例") || SKIP_WEEKLY_SHEETS.has(sheet) ? null : findHeader(ws, ["繳穀農民", "公斤"]);
    if (!header) {
      skipped.push(sheet);
      continue;
    }
    sheets.push(sheet);
    const c = header.cols;
    const col = (k: string) => colOf(c, k);

    for (let r = header.row + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (k: number | null) => (k ? row.getCell(k).value : null);
      const name = asText(get(col("繳穀農民")));
      if (!name || SUBTOTAL_NAMES.has(name)) continue;
      rows.push({
        sheet,
        row: r,
        intakeDate: asDate(get(col("濕穀進儲"))),
        name,
        kg: asNumber(get(col("公斤"))),
        moisture: asNumber(get(col("水分"))),
        sellTo: asText(get(col("預計繳售"))),
        plannedSellDate: asDate(get(col("預定繳售"))),
        remark: asText(get(col("備註"))),
      });
    }
  }
  return { rows, sheets, skipped };
}

/**
 * 公糧表與週報表列印／匯出時，每 26 筆一頁，每頁加「本頁小計」（公斤），最後一頁再加「總合計」。
 * 取代兩份 Excel 裡的 InsertPageSubtotals_FinalFix 巨集。
 */

export const ROWS_PER_PAGE = 26;

export interface Page<T> {
  rows: T[];
  subtotalKg: number;
}

export function paginate<T>(
  rows: T[],
  kgOf: (row: T) => number | null,
  perPage: number = ROWS_PER_PAGE,
): { pages: Page<T>[]; totalKg: number } {
  const pages: Page<T>[] = [];
  for (let i = 0; i < rows.length; i += perPage) {
    const pageRows = rows.slice(i, i + perPage);
    pages.push({ rows: pageRows, subtotalKg: sumKg(pageRows, kgOf) });
  }
  return { pages, totalKg: sumKg(rows, kgOf) };
}

function sumKg<T>(rows: T[], kgOf: (row: T) => number | null): number {
  return rows.reduce((sum, row) => sum + (kgOf(row) ?? 0), 0);
}

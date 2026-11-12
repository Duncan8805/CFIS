// 決定公糧、週報表、收款單要打開哪一個收購點（純函式，方便測試）

/** 記住使用者上次選的收購點，切換頁面時不會跳回第一個 */
export const SITE_COOKIE = "cfis_site";

/**
 * 順序：網址的 ?site= → 上次選的收購點 → 第一個有資料的 → 第一個。
 * `sites` 只有啟用中的收購點；記住的收購點被刪除或停用就略過。
 */
export function pickSite<T extends { id: number }>(
  sites: T[],
  counts: Map<number, number>,
  param: string | undefined,
  remembered?: string,
): T | undefined {
  return (
    sites.find((x) => String(x.id) === param) ??
    sites.find((x) => String(x.id) === remembered) ??
    sites.find((x) => counts.get(x.id)) ??
    sites[0]
  );
}

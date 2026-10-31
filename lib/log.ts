/**
 * 記錄伺服器錯誤。Drizzle 的錯誤物件會帶 SQL 參數（姓名、電話、密碼雜湊），
 * 所以只記錄資料庫回傳的錯誤訊息，不記參數。
 */
export function logError(label: string, err: unknown) {
  const messages: string[] = [];
  for (let e = err as { message?: string; cause?: unknown } | undefined, depth = 0; e && depth < 5; depth++) {
    const msg = String(e.message ?? e).split("\nparams:")[0];
    if (msg && !messages.includes(msg)) messages.push(msg);
    e = e.cause as typeof e;
  }
  console.error(`[${label}]`, messages.join(" ← "));
}

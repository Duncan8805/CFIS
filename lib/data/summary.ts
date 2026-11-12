import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { calcGrain, effectiveRoundingMode } from "@/lib/calc";
import { getCalcSettings } from "./settings";
import { listSites, type Site } from "./sites";
import type { Period } from "./period";

// 總覽、報表用：把一整期的公糧紀錄跟週報表讀出來，照各期自己的計算參數算好再加總

const g = schema.grainRecords;
const w = schema.weeklyEntries;

export interface SiteSummary {
  site: Site;
  count: number;
  kg: number;
  fen: number;
  interest: number;
  freight: number;
  prepaid: number;
  deposit: number;
  collect: number;
  /** 入簿還沒填的筆數（不列入金額） */
  depositMissing: number;
  /** 有填入簿的那些筆的公斤（算每公斤入簿用） */
  depositKg: number;
  /** 收 寫「扣」之類文字的筆數 */
  collectText: number;
  /** 週報表日期、水分都填好的筆數 */
  weeklyDone: number;
  /** 有姓名、週報表還沒填日期或水分的筆數 */
  weeklyPending: number;
  /** 沒有姓名的筆數 */
  noName: number;
}

export interface WeeklyPoint {
  intakeDate: string | null;
  moisture: number | null;
  kg: number | null;
}

export interface PeriodSummary {
  sites: SiteSummary[];
  totals: Omit<SiteSummary, "site">;
  weekly: WeeklyPoint[];
  /** 每位農民（有連到名冊的用名冊，沒有的用姓名）這一期的公斤，報表算集中度用 */
  farmerKg: number[];
}

const zero = (): Omit<SiteSummary, "site"> => ({
  count: 0,
  kg: 0,
  fen: 0,
  interest: 0,
  freight: 0,
  prepaid: 0,
  deposit: 0,
  collect: 0,
  depositMissing: 0,
  depositKg: 0,
  collectText: 0,
  weeklyDone: 0,
  weeklyPending: 0,
  noName: 0,
});

// 金額加總用整數分（×100）避免浮點誤差，最後再換回來
const add = (a: number, b: number) => Math.round((a + b) * 100) / 100;

export async function periodSummary(period: Period, sites?: Site[]): Promise<PeriodSummary> {
  const db = getDb();
  const [allSites, settings, rows] = await Promise.all([
    sites ?? listSites({ includeInactive: true }),
    getCalcSettings(period),
    db
      .select({
        siteId: g.siteId,
        farmerId: g.farmerId,
        name: g.name,
        kg: g.kg,
        fen: g.fen,
        deposit: g.deposit,
        collectOverride: g.collectOverride,
        roundingMode: g.roundingMode,
        intakeDate: w.intakeDate,
        moisture: w.moisture,
      })
      .from(g)
      .leftJoin(w, eq(w.grainRecordId, g.id))
      .where(eq(g.periodId, period.id)),
  ]);

  const bySite = new Map(allSites.map((site) => [site.id, { site, ...zero() }]));
  const totals = zero();
  const farmerKg = new Map<string, number>();
  for (const r of rows) {
    const s = bySite.get(r.siteId);
    if (!s) continue;
    const c = calcGrain(
      { kg: r.kg, fen: r.fen, deposit: r.deposit, collectOverride: r.collectOverride },
      settings.rates,
      effectiveRoundingMode(r.roundingMode, s.site.roundingMode),
    );
    for (const t of [s, totals]) {
      t.count++;
      t.kg += r.kg ?? 0;
      t.fen = add(t.fen, r.fen ?? 0);
      t.interest = add(t.interest, c.interest);
      t.freight = add(t.freight, c.freight);
      t.prepaid = add(t.prepaid, c.prepaid);
      if (r.deposit === null) t.depositMissing++;
      else {
        t.deposit += r.deposit;
        t.depositKg += r.kg ?? 0;
        if (c.collect !== null) t.collect = add(t.collect, c.collect);
      }
      if (c.collectText) t.collectText++;
      if (r.intakeDate && r.moisture !== null) t.weeklyDone++;
      else if (r.name.trim()) t.weeklyPending++;
      if (!r.name.trim()) t.noName++;
    }
    const who = r.farmerId !== null ? `#${r.farmerId}` : r.name.trim();
    if (who && r.kg) farmerKg.set(who, (farmerKg.get(who) ?? 0) + r.kg);
  }

  return {
    sites: [...bySite.values()].filter((s) => s.site.active || s.count > 0),
    totals,
    weekly: rows.map((r) => ({ intakeDate: r.intakeDate, moisture: r.moisture, kg: r.kg })),
    farmerKg: [...farmerKg.values()],
  };
}

/** 最後一次修改公糧或週報表的時間與人 */
export async function lastChange(): Promise<{ at: Date; by: string | null } | null> {
  const [row] = await getDb()
    .select({ at: schema.auditLogs.createdAt, by: schema.users.displayName })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .orderBy(desc(schema.auditLogs.id))
    .limit(1);
  return row ?? null;
}

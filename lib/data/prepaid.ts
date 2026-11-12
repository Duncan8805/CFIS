import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { effectiveRoundingMode } from "@/lib/calc";
import type { PrepaidRow } from "@/lib/calc/prepaid";
import { suggestPlanGuide } from "@/lib/grain/fields";
import type { CalcSettings } from "./settings";
import type { Site } from "./sites";
import type { Period } from "./period";

const g = schema.grainRecords;

/**
 * 報表「先付試算」用：這一期每一筆公糧紀錄的計算欄位。
 * 公斤還沒填、但有核定面積的，用 面積 × 這一期每公頃計畫＋輔導收購量 估算，
 * 這樣面積一登錄完就能先估出這一期要準備多少先付資金。
 */
export async function prepaidRows(period: Period, sites: Site[], settings: CalcSettings): Promise<PrepaidRow[]> {
  const rows = await getDb()
    .select({
      siteId: g.siteId,
      kg: g.kg,
      fen: g.fen,
      deposit: g.deposit,
      collectOverride: g.collectOverride,
      roundingMode: g.roundingMode,
    })
    .from(g)
    .where(eq(g.periodId, period.id));

  const siteMode = new Map(sites.map((s) => [s.id, s.roundingMode]));
  const out: PrepaidRow[] = [];
  for (const r of rows) {
    const mode = siteMode.get(r.siteId);
    if (!mode) continue;
    let kg = r.kg;
    let estimated = false;
    if (!kg && r.fen) {
      const s = suggestPlanGuide(r.fen, settings.planKgPerHa, settings.guideKgPerHa);
      const est = (s.planKg ?? 0) + (s.guideKg ?? 0);
      if (est > 0) {
        kg = est;
        estimated = true;
      }
    }
    out.push({
      siteId: r.siteId,
      kg,
      estimated,
      fen: r.fen,
      deposit: r.deposit,
      hasCollectText: !!r.collectOverride?.trim(),
      mode: effectiveRoundingMode(r.roundingMode, mode),
    });
  }
  return out;
}

import { calcGrain, type RoundingMode, type RemarkMode, weeklyRemark } from "@/lib/calc";
import type { GrainRow, WeeklyRow } from "./excel";

// 把解析出來的公糧列與週報表列配對成「匯入計畫」，並列出所有差異讓使用者確認。
// 規則以東石珍為準：週報表的列順序、公斤都跟公糧相同，姓名從公糧帶入。

export interface SiteConfig {
  id: number;
  name: string;
  weeklySheetName: string;
  sellTo: string;
  remarkMode: RemarkMode;
  agentContact: string | null;
  roundingMode: RoundingMode;
}

export type IssueKind =
  | "calc_mismatch" // 系統算出來的利／運費／先付／收 跟 Excel 不同
  | "name_mismatch" // 公糧與週報表姓名寫法不同
  | "kg_mismatch" // 公糧與週報表公斤不同
  | "weekly_missing" // 公糧有，週報表沒有
  | "weekly_extra" // 週報表有，公糧沒有（不匯入）
  | "phone_leading_zero" // 電話存成數字，開頭的 0 不見了
  | "suspicious_name"; // 姓名看起來不像人名

export interface Issue {
  kind: IssueKind;
  sheet: string;
  row: number;
  message: string;
}

export interface PlannedRecord {
  seq: number;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  kg: number | null;
  fen: number | null;
  deposit: number | null;
  collectOverride: string | null;
  /** 跟收購點設定不同時才有值：Excel 這一列用的是另一種捨入方式 */
  roundingMode: RoundingMode | null;
  weekly: {
    intakeDate: string | null;
    moisture: number | null;
    plannedSellDate: string | null;
    sellToOverride: string | null;
    remarkOverride: string | null;
  } | null;
}

export interface SitePlan {
  siteId: number;
  siteName: string;
  weeklySheetName: string;
  /** 代收人電話（從週報表最常出現的備註推得），只有 agent_contact 的收購點會有 */
  agentContact: string | null;
  records: PlannedRecord[];
  issues: Issue[];
  weeklyMatched: number;
}

export interface ImportPlan {
  sites: SitePlan[];
  /** 公糧 Excel 裡找不到對應收購點的工作表 */
  unknownSheets: string[];
  /** 週報表裡沒有任何收購點對應的工作表（例如 太保轉鹿草） */
  unusedWeeklySheets: string[];
  /** 週報表裡找不到對應工作表的收購點（例如 李金榜） */
  missingWeeklySheets: string[];
}

const normName = (s: string) => s.replace(/\s+/g, "");
const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

/** 兩個電話只差在開頭的 0（Excel 把電話存成數字）時視為相同 */
function samePhone(a: string | null, b: string | null): boolean {
  if ((a ?? "") === (b ?? "")) return true;
  const da = digits(a);
  const db = digits(b);
  return da !== "" && (da === db || da === "0" + db || "0" + da === db);
}

/**
 * 週報表配對：照順序走，同姓名＋同公斤優先；找不到就看同一個位置公斤相同的（姓名打錯）。
 * 往後最多看 LOOKAHEAD 列，用來跳過週報表多出來的列。
 */
const LOOKAHEAD = 5;

function matchWeekly(grain: GrainRow[], weekly: WeeklyRow[]): (WeeklyRow | null)[] {
  const used = new Set<number>();
  const result: (WeeklyRow | null)[] = [];
  let cursor = 0;
  for (const g of grain) {
    let found = -1;
    const end = Math.min(weekly.length, cursor + LOOKAHEAD);
    for (let j = cursor; j < end && found < 0; j++) {
      if (!used.has(j) && normName(weekly[j].name) === normName(g.name)) found = j;
    }
    for (let j = cursor; j < end && found < 0; j++) {
      if (!used.has(j) && g.kg !== null && weekly[j].kg === g.kg) found = j;
    }
    if (found >= 0) {
      used.add(found);
      result.push(weekly[found]);
      cursor = found + 1;
    } else {
      result.push(null);
    }
  }
  return result;
}

function calcDiffs(g: GrainRow, mode: RoundingMode) {
  const r = calcGrain({ kg: g.kg, fen: g.fen, deposit: g.deposit, collectOverride: g.collectOverride }, undefined, mode);
  const pairs: [string, number | null, number | null][] = [
    ["利", g.excel.interest, r.interest],
    ["運費", g.excel.freight, r.freight],
    ["先付", g.excel.prepaid, r.prepaid],
    ["收", g.excel.collect, r.collect],
  ];
  return pairs.filter(([, excel, calc]) => excel !== null && calc !== null && Math.abs(excel - calc) > 0.005);
}

/**
 * 照每一列 Excel 原本的算法：收購點的捨入方式算不出 Excel 的值、換另一種就對時，
 * 這一筆記住另一種（回傳值）。兩種都對不上才回報 calc_mismatch。
 */
function detectRounding(g: GrainRow, siteMode: RoundingMode, issues: Issue[]): RoundingMode | null {
  const diffs = calcDiffs(g, siteMode);
  if (!diffs.length) return null;
  const other: RoundingMode = siteMode === "truncate" ? "none" : "truncate";
  if (!calcDiffs(g, other).length) return other;
  issues.push({
    kind: "calc_mismatch",
    sheet: g.sheet,
    row: g.row,
    message: `${g.name}：${diffs.map(([k, e, c]) => `${k} Excel ${e} / 系統 ${c}`).join("，")}`,
  });
  return null;
}

export function buildImportPlan(grainRows: GrainRow[], weeklyRows: WeeklyRow[], sites: SiteConfig[]): ImportPlan {
  const bySheet = <T extends { sheet: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.sheet, [...(m.get(r.sheet) ?? []), r]);
    return m;
  };
  const grainBySheet = bySheet(grainRows);
  const weeklyBySheet = bySheet(weeklyRows);
  const siteByName = new Map(sites.map((s) => [s.name, s]));

  // 沒有收購點對應的週報表工作表（三合豐 六腳、太保轉鹿草…）：
  // 公糧在自己的週報表找不到時，到這裡找姓名＋公斤都相同的列
  const siteWeeklySheets = new Set(sites.map((s) => s.weeklySheetName));
  const pool = weeklyRows.filter((w) => !siteWeeklySheets.has(w.sheet));
  const poolUsed = new Set<WeeklyRow>();

  const plans: SitePlan[] = [];
  for (const [sheet, grain] of grainBySheet) {
    const site = siteByName.get(sheet);
    if (!site) continue;
    const weekly = weeklyBySheet.get(site.weeklySheetName) ?? [];
    const issues: Issue[] = [];
    const matches = matchWeekly(grain, weekly);
    grain.forEach((g, i) => {
      if (matches[i]) return;
      const hit = pool.find((w) => !poolUsed.has(w) && normName(w.name) === normName(g.name) && w.kg === g.kg);
      if (hit) {
        poolUsed.add(hit);
        matches[i] = hit;
      }
    });

    const agentContact =
      site.remarkMode === "agent_contact"
        ? site.agentContact ?? mostCommon(matches.map((w) => w?.remark ?? null))
        : null;

    const records: PlannedRecord[] = grain.map((g, i) => {
      const roundingMode = detectRounding(g, site.roundingMode, issues);
      if (/^\d+$/.test(g.name)) {
        issues.push({ kind: "suspicious_name", sheet, row: g.row, message: `姓名是「${g.name}」` });
      }
      if (g.phone && /^9\d{8}$/.test(g.phone)) {
        issues.push({
          kind: "phone_leading_zero",
          sheet,
          row: g.row,
          message: `${g.name} 的電話 ${g.phone} 可能少了開頭的 0，匯入時會補成 0${g.phone}`,
        });
      }
      const phone = g.phone && /^9\d{8}$/.test(g.phone) ? "0" + g.phone : g.phone;

      const w = matches[i];
      if (!w) {
        if (weekly.length) {
          issues.push({ kind: "weekly_missing", sheet, row: g.row, message: `${g.name} 在週報表「${site.weeklySheetName}」找不到` });
        }
      } else {
        if (normName(w.name) !== normName(g.name)) {
          issues.push({
            kind: "name_mismatch",
            sheet,
            row: g.row,
            message: `公糧「${g.name}」／週報表「${w.name}」（第 ${w.row} 列），以公糧為準`,
          });
        }
        if (w.kg !== g.kg) {
          issues.push({
            kind: "kg_mismatch",
            sheet,
            row: g.row,
            message: `${g.name}：公糧 ${g.kg} 公斤／週報表 ${w.kg} 公斤，以公糧為準`,
          });
        }
      }

      const defaultRemark = weeklyRemark({ mode: site.remarkMode, farmerPhone: phone, agentContact });
      const remarkSame =
        !w?.remark || w.remark === defaultRemark || (site.remarkMode === "farmer_phone" && samePhone(w.remark, phone));

      return {
        seq: i + 1,
        code: g.code,
        name: g.name,
        phone,
        address: g.address,
        kg: g.kg,
        fen: g.fen,
        deposit: g.deposit,
        collectOverride: g.collectOverride,
        roundingMode,
        weekly: w
          ? {
              intakeDate: w.intakeDate,
              moisture: w.moisture,
              plannedSellDate: w.plannedSellDate,
              sellToOverride: w.sellTo && w.sellTo !== site.sellTo ? w.sellTo : null,
              remarkOverride: remarkSame ? null : w.remark,
            }
          : null,
      };
    });

    const usedRows = new Set(matches.filter((m): m is WeeklyRow => !!m));
    for (const w of weekly) {
      if (!usedRows.has(w)) {
        issues.push({
          kind: "weekly_extra",
          sheet: site.weeklySheetName,
          row: w.row,
          message: `週報表多一列：${w.name} ${w.kg ?? ""} 公斤（公糧沒有，不匯入）`,
        });
      }
    }

    plans.push({
      siteId: site.id,
      siteName: site.name,
      weeklySheetName: site.weeklySheetName,
      agentContact,
      records,
      issues,
      weeklyMatched: matches.filter(Boolean).length,
    });
  }

  const usedWeekly = new Set([...plans.map((p) => p.weeklySheetName), ...[...poolUsed].map((w) => w.sheet)]);
  return {
    sites: plans.sort((a, b) => sites.findIndex((s) => s.id === a.siteId) - sites.findIndex((s) => s.id === b.siteId)),
    unknownSheets: [...grainBySheet.keys()].filter((s) => !siteByName.has(s)),
    unusedWeeklySheets: [...weeklyBySheet.keys()].filter((s) => !usedWeekly.has(s)),
    missingWeeklySheets: weeklyRows.length
      ? plans.filter((p) => !weeklyBySheet.has(p.weeklySheetName)).map((p) => p.siteName)
      : [],
  };
}

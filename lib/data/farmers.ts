import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const f = schema.farmers;
const g = schema.grainRecords;

export interface FarmerDto {
  id: number;
  fileNo: string | null;
  name: string;
  phone: string | null;
  address: string | null;
}

const farmerColumns = { id: f.id, fileNo: f.fileNo, name: f.name, phone: f.phone, address: f.address };

/** 整本名冊（公糧輸入時帶出資料用） */
export async function listFarmers(): Promise<FarmerDto[]> {
  return getDb().select(farmerColumns).from(f).orderBy(asc(f.name), asc(f.id));
}

export interface FarmerRow extends FarmerDto {
  /** 這一期在哪些收購點、合計幾公斤（沒繳就是空的） */
  sites: string[];
  kg: number | null;
}

/** 農民名冊頁：每位農民加上這一期的收購點與公斤 */
export async function listFarmersWithPeriod(periodId: number): Promise<FarmerRow[]> {
  const db = getDb();
  const [farmers, usage] = await Promise.all([
    listFarmers(),
    db
      .select({ farmerId: g.farmerId, site: schema.sites.name, kg: sql<number>`sum(${g.kg})` })
      .from(g)
      .innerJoin(schema.sites, eq(g.siteId, schema.sites.id))
      .where(eq(g.periodId, periodId))
      .groupBy(g.farmerId, schema.sites.name),
  ]);
  const byFarmer = new Map<number, { sites: string[]; kg: number | null }>();
  for (const u of usage) {
    if (u.farmerId === null) continue;
    const entry = byFarmer.get(u.farmerId) ?? { sites: [], kg: null };
    entry.sites.push(u.site);
    if (u.kg !== null) entry.kg = (entry.kg ?? 0) + Number(u.kg);
    byFarmer.set(u.farmerId, entry);
  }
  return farmers.map((farmer) => ({ ...farmer, ...(byFarmer.get(farmer.id) ?? { sites: [], kg: null }) }));
}

export interface FarmerHistoryRow {
  recordId: number;
  periodId: number;
  rocYear: number;
  term: number;
  site: string;
  siteRoundingMode: "truncate" | "none";
  kg: number | null;
  fen: number | null;
  deposit: number | null;
  collectOverride: string | null;
  roundingMode: "truncate" | "none" | null;
}

/** 某位農民歷期的繳穀紀錄 */
export async function farmerHistory(farmerId: number): Promise<FarmerHistoryRow[]> {
  return getDb()
    .select({
      recordId: g.id,
      periodId: g.periodId,
      rocYear: schema.periods.rocYear,
      term: schema.periods.term,
      site: schema.sites.name,
      siteRoundingMode: schema.sites.roundingMode,
      kg: g.kg,
      fen: g.fen,
      deposit: g.deposit,
      collectOverride: g.collectOverride,
      roundingMode: g.roundingMode,
    })
    .from(g)
    .innerJoin(schema.periods, eq(g.periodId, schema.periods.id))
    .innerJoin(schema.sites, eq(g.siteId, schema.sites.id))
    .where(eq(g.farmerId, farmerId))
    .orderBy(desc(schema.periods.rocYear), desc(schema.periods.term), asc(g.seq));
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Db = ReturnType<typeof getDb> | Tx;

interface RecordForLink {
  farmerId: number | null;
  fileNo: string | null;
  name: string;
  phone: string | null;
  address: string | null;
}

/** 名冊上空白的欄位，用公糧紀錄的資料補上（不覆蓋已經有的） */
async function fillBlanks(db: Db, farmer: FarmerDto, rec: RecordForLink) {
  const set: Partial<FarmerDto> = {};
  if (!farmer.name && rec.name) set.name = rec.name;
  if (!farmer.phone && rec.phone) set.phone = rec.phone;
  if (!farmer.address && rec.address) set.address = rec.address;
  if (Object.keys(set).length) await db.update(f).set(set).where(eq(f.id, farmer.id));
}

async function farmerBy(db: Db, where: ReturnType<typeof eq>) {
  const [row] = await db.select(farmerColumns).from(f).where(where).limit(1);
  return row ?? null;
}

/**
 * 公糧紀錄對應到名冊上的哪一位農民：
 * - 有檔號：找同檔號的農民；名冊沒有這個檔號時，原本連到的農民還沒有檔號就補上，否則新增一位
 * - 沒檔號：沿用原本連到的；沒有的話用姓名找還沒有檔號的農民，再沒有就新增
 * 名冊上空白的姓名、電話、地址會用這一筆補上。
 * 回傳農民 id（沒有姓名也沒有檔號時維持原樣）。
 */
export async function resolveFarmer(db: Db, rec: RecordForLink): Promise<number | null> {
  if (rec.fileNo) {
    const byFileNo = await farmerBy(db, eq(f.fileNo, rec.fileNo));
    if (byFileNo) {
      await fillBlanks(db, byFileNo, rec);
      return byFileNo.id;
    }
    if (rec.farmerId) {
      const linked = await farmerBy(db, eq(f.id, rec.farmerId));
      if (linked && !linked.fileNo) {
        await db.update(f).set({ fileNo: rec.fileNo }).where(eq(f.id, linked.id));
        await fillBlanks(db, linked, rec);
        return linked.id;
      }
    }
    const [{ id }] = await db
      .insert(f)
      .values({ fileNo: rec.fileNo, name: rec.name, phone: rec.phone, address: rec.address })
      .$returningId();
    return Number(id);
  }
  if (rec.farmerId) {
    const linked = await farmerBy(db, eq(f.id, rec.farmerId));
    if (linked) await fillBlanks(db, linked, rec);
    return rec.farmerId;
  }
  if (!rec.name) return null;
  const sameName = await farmerBy(db, and(eq(f.name, rec.name), isNull(f.fileNo)) as ReturnType<typeof eq>);
  if (sameName) {
    await fillBlanks(db, sameName, rec);
    return sameName.id;
  }
  const [{ id }] = await db.insert(f).values({ name: rec.name, phone: rec.phone, address: rec.address }).$returningId();
  return Number(id);
}

/**
 * 匯入後一次把這些紀錄依姓名連到名冊（Excel 沒有檔號）：名冊沒有的姓名先新增，再整批連上。
 * 用兩句 SQL 做完，避免一筆一筆查。
 */
export async function linkRecordsToFarmers(db: Db, recordIds: number[]) {
  if (!recordIds.length) return;
  const ids = sql.join(
    recordIds.map((id) => sql`${id}`),
    sql`, `,
  );
  await db.execute(sql`
    INSERT INTO ${f} (${f.name}, ${f.phone}, ${f.address})
    SELECT r.name, r.phone, r.address
    FROM ${g} r
    JOIN (SELECT name, MAX(id) AS id FROM ${g} WHERE id IN (${ids}) AND name <> '' AND farmer_id IS NULL GROUP BY name) latest
      ON latest.id = r.id
    WHERE NOT EXISTS (SELECT 1 FROM ${f} x WHERE x.name = r.name AND x.file_no IS NULL)`);
  await db.execute(sql`
    UPDATE ${g} r
    JOIN ${f} x ON x.name = r.name AND x.file_no IS NULL
    SET r.farmer_id = x.id
    WHERE r.id IN (${ids}) AND r.name <> '' AND r.farmer_id IS NULL`);
}

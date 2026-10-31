import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
  boolean,
} from "drizzle-orm/mysql-core";

// 資料庫只存「手動輸入」的欄位；利、運費、先付、收、折算率、濕穀數量都由 lib/calc 即時計算。

const id = () => bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();
const ref = (name: string) => bigint(name, { mode: "number", unsigned: true });
const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
};

/** 期別，例如 115 年第 1 期 */
export const periods = mysqlTable(
  "periods",
  {
    id: id(),
    rocYear: smallint("roc_year").notNull(),
    term: tinyint("term").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("periods_year_term").on(t.rocYear, t.term)],
);

/** 收購點（公糧 Excel 的一張工作表），例如 東石珍、朴子阿財 */
export const sites = mysqlTable(
  "sites",
  {
    id: id(),
    name: varchar("name", { length: 32 }).notNull(),
    /** 週報表的工作表名稱（例如 公糧「玉豐過溝」→ 週報表「玉峰過溝」） */
    weeklySheetName: varchar("weekly_sheet_name", { length: 32 }).notNull(),
    /** 週報表 G 欄「預計繳售公糧業者名稱」，例如 東石珍 → 東石 */
    sellTo: varchar("sell_to", { length: 32 }).notNull(),
    /** 週報表備註：農民電話，或代收人電話 */
    remarkMode: mysqlEnum("remark_mode", ["farmer_phone", "agent_contact"]).notNull().default("farmer_phone"),
    /** 代收人電話，例如「珍0910163244/3703527」 */
    agentContact: varchar("agent_contact", { length: 100 }),
    /** 利、運費是否無條件捨去（朴子、鹿草等幾張表沒有捨去） */
    roundingMode: mysqlEnum("rounding_mode", ["truncate", "none"]).notNull().default("truncate"),
    sortOrder: int("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("sites_name").on(t.name)],
);

/** 農民名冊：輸入時自動帶出電話、地址 */
export const farmers = mysqlTable(
  "farmers",
  {
    id: id(),
    name: varchar("name", { length: 32 }).notNull(),
    phone: varchar("phone", { length: 100 }),
    address: varchar("address", { length: 200 }),
    ...timestamps,
  },
  (t) => [index("farmers_name").on(t.name)],
);

/** 公糧紀錄（公糧 Excel 的一列）。姓名、電話、地址存在紀錄上，跟 Excel 一樣每期各自保留。 */
export const grainRecords = mysqlTable(
  "grain_records",
  {
    id: id(),
    periodId: ref("period_id")
      .notNull()
      .references(() => periods.id),
    siteId: ref("site_id")
      .notNull()
      .references(() => sites.id),
    farmerId: ref("farmer_id").references(() => farmers.id),
    /** 列的順序；週報表也照這個順序 */
    seq: int("seq").notNull(),
    /** 編號 */
    code: varchar("code", { length: 20 }),
    name: varchar("name", { length: 32 }).notNull(),
    phone: varchar("phone", { length: 100 }),
    address: varchar("address", { length: 200 }),
    kg: int("kg"),
    /** 分，4 位小數 */
    fen: decimal("fen", { precision: 8, scale: 4, mode: "number" }),
    /** 入簿 */
    deposit: int("deposit"),
    /** 收 欄的手動文字，例如「扣」「5/24扣」 */
    collectOverride: varchar("collect_override", { length: 20 }),
    /** 這一筆自己的捨入方式；空白時用收購點的設定（鹿草第 111–116 列就跟整張表不同） */
    roundingMode: mysqlEnum("rounding_mode", ["truncate", "none"]),
    updatedBy: ref("updated_by"),
    ...timestamps,
  },
  (t) => [index("grain_period_site_seq").on(t.periodId, t.siteId, t.seq)],
);

/** 週報表紀錄，跟公糧紀錄一對一。姓名、公斤一律從公糧紀錄帶入，不另外存。 */
export const weeklyEntries = mysqlTable(
  "weekly_entries",
  {
    id: id(),
    grainRecordId: ref("grain_record_id")
      .notNull()
      .references(() => grainRecords.id, { onDelete: "cascade" }),
    /** 濕穀進儲日期 */
    intakeDate: date("intake_date", { mode: "string" }),
    /** 水分 */
    moisture: tinyint("moisture"),
    /** 預定繳售日期 */
    plannedSellDate: date("planned_sell_date", { mode: "string" }),
    /** 覆寫收購點預設的繳售業者 */
    sellToOverride: varchar("sell_to_override", { length: 32 }),
    /** 覆寫收購點預設的備註（例如東石珍的張設奇填自己電話） */
    remarkOverride: varchar("remark_override", { length: 100 }),
    updatedBy: ref("updated_by"),
    ...timestamps,
  },
  (t) => [uniqueIndex("weekly_grain_record").on(t.grainRecordId)],
);

/** 濕稻穀含水量 → 折算率 */
export const moistureRates = mysqlTable("moisture_rates", {
  moisture: tinyint("moisture").primaryKey(),
  rate: decimal("rate", { precision: 4, scale: 2, mode: "number" }).notNull(),
});

/** 系統設定：每分利（4000）、每公斤運費（0.35）等 */
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: json("value").notNull(),
  ...timestamps,
});

/** 收款單上印的農會帳號 */
export const bankAccounts = mysqlTable("bank_accounts", {
  id: id(),
  org: varchar("org", { length: 64 }).notNull(),
  unitCode: varchar("unit_code", { length: 16 }).notNull(),
  accountNo: varchar("account_no", { length: 32 }).notNull(),
  holder: varchar("holder", { length: 32 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const users = mysqlTable(
  "users",
  {
    id: id(),
    username: varchar("username", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 64 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["admin", "staff"]).notNull().default("staff"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_username").on(t.username)],
);

export const sessions = mysqlTable(
  "sessions",
  {
    /** session token 的 SHA-256，不存原始 token */
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: ref("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

/** 修改紀錄：誰在什麼時候改了哪一筆 */
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: id(),
    userId: ref("user_id"),
    entity: varchar("entity", { length: 32 }).notNull(),
    entityId: ref("entity_id").notNull(),
    action: mysqlEnum("action", ["create", "update", "delete"]).notNull(),
    changes: json("changes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_entity").on(t.entity, t.entityId)],
);

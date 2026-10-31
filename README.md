# 長富整合平台（CFIS）

公糧輸入、週報表、收款單的整合系統。輸入一次公糧，週報表的姓名、公斤自動帶入。

- 前後端：Next.js（[vinext](https://github.com/cloudflare/vinext)）+ TypeScript，部署在 Cloudflare Workers
- 資料庫：TiDB Cloud，透過 `@tidbcloud/serverless` + Drizzle ORM
- 介面：Tailwind，支援 RWD 與 PWA（可安裝到桌面／手機主畫面）

## 第一次設定

```bash
npm install
cp .dev.vars.example .dev.vars   # 填入 TiDB 的 DATABASE_URL
npm run db:migrate               # 建立資料表與初始資料
npm run user:create -- <帳號> <顯示名稱> admin   # 建立登入帳號（密碼用隱藏輸入）
```

第一次登入後，到「設定 → 匯入 Excel」把現有的公糧 Excel 與週報表轉進來。
匯入前會列出每一筆差異（姓名寫法不同、公斤不同、計算跟 Excel 不同…），確認後才寫入；
同一個收購點重複匯入會整批取代。

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 本機開發 |
| `npm test` | 計算邏輯測試（以東石珍的 Excel 數值為基準） |
| `npm run typecheck` | 型別檢查 |
| `npm run build` / `npm run start` | 建置並在本機預覽正式版 |
| `npm run deploy` | 部署到 Cloudflare Workers |
| `npm run db:generate` | 改了 `lib/db/schema.ts` 後產生 migration |

正式環境的 `DATABASE_URL` 用 Cloudflare 的 secret 設定，不要寫進程式碼。

## 結構

```
lib/calc/     計算邏輯（利、運費、先付、收、折算率、濕穀數量、隨機水分、分頁小計）
lib/import/   讀取 Excel、配對公糧與週報表、列出差異
lib/auth/     密碼雜湊（PBKDF2）與 session
lib/db/       資料表結構與連線
proxy.ts      沒登入就導去登入頁
scripts/      建立帳號等管理指令
drizzle/      SQL migration 與初始資料
app/          頁面
components/   共用元件（App 外殼、離線提示、service worker 註冊）
public/sw.js  service worker（離線快取）
```

## 計算規則

所有公式都在 `lib/calc`，跟原本 Excel 一致：

| 欄位 | 公式 |
|---|---|
| 利 | `ROUNDDOWN(分 × 4000)`（朴子、鹿草等收購點不捨去） |
| 運費 | `ROUNDDOWN(公斤 × 0.35)` |
| 先付 | 利 − 運費 |
| 收 | 入簿 − 先付（可手動改成「扣」） |
| 濕稻穀折算 | 依水分查折算率表，低於 24 為 0 |
| 濕稻穀數量 | `ROUND(公斤 ÷ 折算)` |

資料庫只存手動輸入的欄位，計算欄位一律即時算，避免改了公斤卻沒更新運費。

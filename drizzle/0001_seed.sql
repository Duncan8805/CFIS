-- 初始資料：折算率表、計算參數、收購點對應規則。
-- 代收人電話（agent_contact）屬於個資，不寫在 git 裡，匯入 Excel 或在設定頁填入。
-- 標 TODO 的收購點規則尚待確認。

INSERT INTO `moisture_rates` (`moisture`, `rate`) VALUES
  (24, 0.83), (25, 0.82), (26, 0.81), (27, 0.80), (28, 0.79),
  (29, 0.78), (30, 0.76), (31, 0.74), (32, 0.72);
--> statement-breakpoint
INSERT INTO `settings` (`key`, `value`) VALUES
  ('grain.interestPerFen', '4000'),
  ('grain.freightPerKg', '0.35'),
  ('report.rowsPerPage', '26'),
  ('report.vendorName', '"長富"');
--> statement-breakpoint
INSERT INTO `sites` (`name`, `weekly_sheet_name`, `sell_to`, `remark_mode`, `rounding_mode`, `sort_order`) VALUES
  ('六腳',     '六腳',      '六腳',     'farmer_phone',  'truncate', 10),
  ('六腳珍',   '六腳珍',    '六腳',     'agent_contact', 'truncate', 20),
  -- TODO: 三合豐在週報表分成「三合豐 玉豐」「三合豐 六腳」兩張，個別紀錄要覆寫繳售業者
  ('三合豐',   '三合豐 玉豐', '三合豐→玉豐', 'farmer_phone', 'truncate', 30),
  ('玉豐',     '玉豐',      '玉豐',     'farmer_phone',  'truncate', 40),
  ('合成',     '合成',      '合成',     'farmer_phone',  'truncate', 50),
  ('東石珍',   '東石珍',    '東石',     'agent_contact', 'truncate', 60),
  ('朴子',     '朴子',      '朴子',     'farmer_phone',  'none',     70),
  ('鹿草',     '鹿草',      '鹿草',     'farmer_phone',  'none',     80),
  ('松梅',     '松梅',      '松梅',     'farmer_phone',  'truncate', 90),
  ('玉豐過溝', '玉峰過溝',  '玉豐過溝', 'farmer_phone',  'truncate', 100),
  ('朴子阿財', '朴子阿財',  '朴子',     'agent_contact', 'none',     110),
  -- TODO: 李金榜在週報表沒有獨立工作表
  ('李金榜',   '李金榜',    '朴子',     'agent_contact', 'truncate', 120),
  ('朴子彩鳳', '朴子彩鳳',  '朴子',     'agent_contact', 'none',     130),
  ('朴子嘉文', '朴子嘉文',  '朴子',     'agent_contact', 'none',     140),
  -- TODO: 週報表上朴子慶賀的繳售業者是空白，暫定朴子
  ('朴子慶賀', '朴子慶賀',  '朴子',     'agent_contact', 'none',     150),
  ('朴子水福', '朴子水福',  '朴子',     'agent_contact', 'none',     160),
  ('東石',     '東石',      '東石',     'farmer_phone',  'truncate', 170);
--> statement-breakpoint
INSERT INTO `periods` (`roc_year`, `term`) VALUES (115, 1);

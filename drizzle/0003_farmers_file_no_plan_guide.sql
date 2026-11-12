ALTER TABLE `farmers` ADD `file_no` varchar(9);--> statement-breakpoint
ALTER TABLE `grain_records` ADD `file_no` varchar(9);--> statement-breakpoint
ALTER TABLE `grain_records` ADD `plan_kg` int;--> statement-breakpoint
ALTER TABLE `grain_records` ADD `guide_kg` int;--> statement-breakpoint
ALTER TABLE `periods` ADD `interest_per_fen` decimal(12,4);--> statement-breakpoint
ALTER TABLE `periods` ADD `freight_per_kg` decimal(8,4);--> statement-breakpoint
ALTER TABLE `periods` ADD `plan_kg_per_ha` int;--> statement-breakpoint
ALTER TABLE `periods` ADD `guide_kg_per_ha` int;--> statement-breakpoint
ALTER TABLE `periods` ADD `moisture_rates` json;--> statement-breakpoint
ALTER TABLE `farmers` ADD CONSTRAINT `farmers_file_no` UNIQUE(`file_no`);--> statement-breakpoint
CREATE INDEX `grain_farmer` ON `grain_records` (`farmer_id`);--> statement-breakpoint
-- 農民名冊：用現有公糧紀錄的姓名建立（每個姓名一筆，電話、地址取最新那一筆），檔號之後再補
INSERT INTO `farmers` (`name`, `phone`, `address`)
SELECT g.`name`, g.`phone`, g.`address`
FROM `grain_records` g
JOIN (SELECT `name`, MAX(`id`) AS `id` FROM `grain_records` WHERE `name` <> '' GROUP BY `name`) latest ON latest.`id` = g.`id`
WHERE NOT EXISTS (SELECT 1 FROM `farmers` f WHERE f.`name` = g.`name`);--> statement-breakpoint
UPDATE `grain_records` g
JOIN `farmers` f ON f.`name` = g.`name` AND f.`file_no` IS NULL
SET g.`farmer_id` = f.`id`
WHERE g.`name` <> '' AND g.`farmer_id` IS NULL;

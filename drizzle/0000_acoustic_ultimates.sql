CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`entity` varchar(32) NOT NULL,
	`entity_id` bigint unsigned NOT NULL,
	`action` enum('create','update','delete') NOT NULL,
	`changes` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org` varchar(64) NOT NULL,
	`unit_code` varchar(16) NOT NULL,
	`account_no` varchar(32) NOT NULL,
	`holder` varchar(32) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `farmers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`phone` varchar(100),
	`address` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `farmers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grain_records` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`period_id` bigint unsigned NOT NULL,
	`site_id` bigint unsigned NOT NULL,
	`farmer_id` bigint unsigned,
	`seq` int NOT NULL,
	`code` varchar(20),
	`name` varchar(32) NOT NULL,
	`phone` varchar(100),
	`address` varchar(200),
	`kg` int,
	`fen` decimal(8,4),
	`deposit` int,
	`collect_override` varchar(20),
	`updated_by` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grain_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moisture_rates` (
	`moisture` tinyint NOT NULL,
	`rate` decimal(4,2) NOT NULL,
	CONSTRAINT `moisture_rates_moisture` PRIMARY KEY(`moisture`)
);
--> statement-breakpoint
CREATE TABLE `periods` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`roc_year` smallint NOT NULL,
	`term` tinyint NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `periods_year_term` UNIQUE(`roc_year`,`term`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(64) NOT NULL,
	`value` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`weekly_sheet_name` varchar(32) NOT NULL,
	`sell_to` varchar(32) NOT NULL,
	`remark_mode` enum('farmer_phone','agent_contact') NOT NULL DEFAULT 'farmer_phone',
	`agent_contact` varchar(100),
	`rounding_mode` enum('truncate','none') NOT NULL DEFAULT 'truncate',
	`sort_order` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`),
	CONSTRAINT `sites_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`display_name` varchar(64) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('admin','staff') NOT NULL DEFAULT 'staff',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `weekly_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`grain_record_id` bigint unsigned NOT NULL,
	`intake_date` date,
	`moisture` tinyint,
	`planned_sell_date` date,
	`sell_to_override` varchar(32),
	`remark_override` varchar(100),
	`updated_by` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_grain_record` UNIQUE(`grain_record_id`)
);
--> statement-breakpoint
ALTER TABLE `grain_records` ADD CONSTRAINT `grain_records_period_id_periods_id_fk` FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grain_records` ADD CONSTRAINT `grain_records_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grain_records` ADD CONSTRAINT `grain_records_farmer_id_farmers_id_fk` FOREIGN KEY (`farmer_id`) REFERENCES `farmers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_entries` ADD CONSTRAINT `weekly_entries_grain_record_id_grain_records_id_fk` FOREIGN KEY (`grain_record_id`) REFERENCES `grain_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_entity` ON `audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `farmers_name` ON `farmers` (`name`);--> statement-breakpoint
CREATE INDEX `grain_period_site_seq` ON `grain_records` (`period_id`,`site_id`,`seq`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);
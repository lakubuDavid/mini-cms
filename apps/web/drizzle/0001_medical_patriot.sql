CREATE TABLE `apikey` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`prefix` text,
	`key` text NOT NULL,
	`reference_id` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`rate_limit_enabled` integer DEFAULT true NOT NULL,
	`rate_limit_time_window` integer,
	`rate_limit_max` integer,
	`request_count` integer DEFAULT 0 NOT NULL,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `apikey_config_id_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX `apikey_reference_id_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `collections` ADD `organization_id` text REFERENCES organizations(id);--> statement-breakpoint
UPDATE `collections`
SET `organization_id` = (
  SELECT `id`
  FROM `organizations`
  ORDER BY `created_at` ASC
  LIMIT 1
)
WHERE `organization_id` IS NULL;--> statement-breakpoint
CREATE TABLE `__new_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`schema` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_collections` (`id`, `organization_id`, `name`, `slug`, `description`, `schema`, `created_at`, `updated_at`)
SELECT `id`, `organization_id`, `name`, `slug`, `description`, `schema`, `created_at`, `updated_at`
FROM `collections`;--> statement-breakpoint
DROP TABLE `collections`;--> statement-breakpoint
ALTER TABLE `__new_collections` RENAME TO `collections`;--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_slug_idx` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_organization_id_idx` ON `collections` (`organization_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;

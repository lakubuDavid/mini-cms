PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);--> statement-breakpoint
CREATE INDEX `projects_organization_id_idx` ON `projects` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_organization_slug_uidx` ON `projects` (`organization_id`, `slug`);--> statement-breakpoint
INSERT INTO `projects` (`id`, `organization_id`, `name`, `slug`, `created_at`, `updated_at`, `metadata`)
SELECT
	'project_default_' || `id`,
	`id`,
	'Default',
	'default',
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	'{"isDefault":true}'
FROM `organizations`;--> statement-breakpoint
ALTER TABLE `collections` ADD `project_id` text REFERENCES `projects`(`id`);--> statement-breakpoint
UPDATE `collections`
SET `project_id` = 'project_default_' || `organization_id`
WHERE `project_id` IS NULL;--> statement-breakpoint
CREATE TABLE `__new_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	`project_id` text NOT NULL REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`schema` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_collections` (`id`, `organization_id`, `project_id`, `name`, `slug`, `description`, `schema`, `created_at`, `updated_at`)
SELECT `id`, `organization_id`, `project_id`, `name`, `slug`, `description`, `schema`, `created_at`, `updated_at`
FROM `collections`;--> statement-breakpoint
DROP TABLE `collections`;--> statement-breakpoint
ALTER TABLE `__new_collections` RENAME TO `collections`;--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_slug_idx` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `collections_organization_id_idx` ON `collections` (`organization_id`);--> statement-breakpoint
CREATE INDEX `collections_project_id_idx` ON `collections` (`project_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;

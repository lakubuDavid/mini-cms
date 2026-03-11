PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
INSERT INTO `__new_collections` (
	`id`,
	`organization_id`,
	`project_id`,
	`name`,
	`slug`,
	`description`,
	`schema`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`organization_id`,
	`project_id`,
	`name`,
	`slug`,
	`description`,
	`schema`,
	`created_at`,
	`updated_at`
FROM `collections`;--> statement-breakpoint
DROP TABLE `collections`;--> statement-breakpoint
ALTER TABLE `__new_collections` RENAME TO `collections`;--> statement-breakpoint
CREATE INDEX `collections_organization_id_idx` ON `collections` (`organization_id`);--> statement-breakpoint
CREATE INDEX `collections_project_id_idx` ON `collections` (`project_id`);--> statement-breakpoint
CREATE INDEX `collections_slug_idx` ON `collections` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `collections_project_slug_uidx` ON `collections` (`project_id`, `slug`);--> statement-breakpoint
PRAGMA foreign_keys=ON;

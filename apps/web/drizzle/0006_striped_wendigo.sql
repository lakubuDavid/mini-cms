CREATE TABLE IF NOT EXISTS `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	`project_id` text NOT NULL REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`public_url` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`uploaded_by_id` text REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assets_organization_id_idx` ON `assets` (`organization_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assets_project_id_idx` ON `assets` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assets_uploaded_by_id_idx` ON `assets` (`uploaded_by_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assets_status_idx` ON `assets` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `assets_storage_key_uidx` ON `assets` (`storage_key`);--> statement-breakpoint
ALTER TABLE `projects` ADD `api_access` text DEFAULT '{"type":"public"}' NOT NULL;

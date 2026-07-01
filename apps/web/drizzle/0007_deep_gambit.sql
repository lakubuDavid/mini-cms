CREATE TABLE `environments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`is_production` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `environments_project_id_idx` ON `environments` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `environments_project_slug_uidx` ON `environments` (`project_id`,`slug`);--> statement-breakpoint
ALTER TABLE `collection_items` ADD `environment_id` text REFERENCES environments(id);--> statement-breakpoint
CREATE INDEX `collection_items_environment_id_idx` ON `collection_items` (`environment_id`);
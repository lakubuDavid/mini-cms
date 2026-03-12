CREATE TABLE `request_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	`collection_slug` text NOT NULL,
	`origin_domain` text DEFAULT 'unknown' NOT NULL,
	`timestamp` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `request_logs_project_id_idx` ON `request_logs` (`project_id`);--> statement-breakpoint
CREATE INDEX `request_logs_timestamp_idx` ON `request_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `request_logs_origin_domain_idx` ON `request_logs` (`origin_domain`);--> statement-breakpoint
CREATE INDEX `request_logs_collection_slug_idx` ON `request_logs` (`collection_slug`);

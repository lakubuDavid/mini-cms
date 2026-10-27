CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_members_organization_id_idx` ON `project_members` (`organization_id`);--> statement-breakpoint
CREATE INDEX `project_members_member_id_idx` ON `project_members` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_members_project_member_uidx` ON `project_members` (`project_id`,`member_id`);--> statement-breakpoint
-- Existing members kept access to every project before this migration. Seed
-- those rows so deploying scoped access does not lock anyone out.
INSERT INTO `project_members` (`id`, `organization_id`, `project_id`, `member_id`, `created_at`)
SELECT
	lower(hex(randomblob(16))),
	p.`organization_id`,
	p.`id`,
	m.`id`,
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `projects` p
JOIN `members` m ON m.`organization_id` = p.`organization_id`
WHERE m.`role` NOT IN ('owner', 'admin');
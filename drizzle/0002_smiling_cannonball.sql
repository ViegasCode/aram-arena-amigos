CREATE TABLE `mayhem_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`played_at` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	`void_reason` text
);
--> statement-breakpoint
CREATE TABLE `mayhem_results` (
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`win` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `mayhem_matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mayhem_result_once` ON `mayhem_results` (`match_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `mayhem_results_player` ON `mayhem_results` (`player_id`);
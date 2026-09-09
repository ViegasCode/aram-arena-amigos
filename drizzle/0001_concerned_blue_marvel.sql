ALTER TABLE `players` ADD `user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `players_user_account` ON `players` (`user_id`);
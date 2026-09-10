CREATE TABLE `riot_profiles` (
	`player_id` text PRIMARY KEY NOT NULL,
	`riot_id` text NOT NULL,
	`tagline` text NOT NULL,
	`profile` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);

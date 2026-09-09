CREATE TABLE `adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`points` real NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `championships` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rules` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`championship_id` text NOT NULL,
	`status` text NOT NULL,
	`teams` text NOT NULL,
	`created_at` text NOT NULL,
	`confirmed_at` text,
	`completed_at` text,
	`duration` integer,
	`winner` integer,
	`match_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`rules` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_current_match` ON `matches` (`championship_id`) WHERE "matches"."status" in ('draft','confirmed');--> statement-breakpoint
CREATE UNIQUE INDEX `unique_riot_match` ON `matches` (`match_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`riot_id` text NOT NULL,
	`tagline` text NOT NULL,
	`puuid` text,
	`icon` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_riot_account` ON `players` (`riot_id`,`tagline`);--> statement-breakpoint
CREATE TABLE `match_players` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`team` integer NOT NULL,
	`champion` text NOT NULL,
	`stats` text NOT NULL,
	`grade` real NOT NULL,
	`explanation` text NOT NULL,
	`win` integer NOT NULL,
	`bonus` real NOT NULL,
	`points` real NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `result_once` ON `match_players` (`match_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `results_player` ON `match_players` (`player_id`);
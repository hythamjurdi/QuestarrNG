CREATE TABLE `game_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`game_id` text NOT NULL,
	`added_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`list_id`) REFERENCES `game_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_list_items_list_game_idx` ON `game_list_items` (`list_id`,`game_id`);--> statement-breakpoint
CREATE INDEX `game_list_items_game_idx` ON `game_list_items` (`game_id`);--> statement-breakpoint
CREATE TABLE `game_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_lists_user_name_idx` ON `game_lists` (`user_id`,`name`);
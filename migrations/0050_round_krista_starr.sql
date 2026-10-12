ALTER TABLE `user_settings` ADD `release_scoring_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `release_scoring_profile` text;
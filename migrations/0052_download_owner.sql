ALTER TABLE `game_downloads` ADD `owner_user_id` text REFERENCES users(id) ON DELETE cascade;--> statement-breakpoint
UPDATE `game_downloads`
SET `owner_user_id` = (SELECT `user_id` FROM `games` WHERE `games`.`id` = `game_downloads`.`game_id`)
WHERE `owner_user_id` IS NULL;--> statement-breakpoint
CREATE INDEX `game_downloads_owner_status_idx` ON `game_downloads` (`owner_user_id`,`status`);

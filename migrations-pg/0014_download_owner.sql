ALTER TABLE "game_downloads" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "game_downloads" ADD CONSTRAINT "game_downloads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "game_downloads"
SET "owner_user_id" = (SELECT "user_id" FROM "games" WHERE "games"."id" = "game_downloads"."game_id")
WHERE "owner_user_id" IS NULL;--> statement-breakpoint
CREATE INDEX "game_downloads_owner_status_idx" ON "game_downloads" USING btree ("owner_user_id","status");

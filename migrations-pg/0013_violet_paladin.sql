CREATE TABLE "game_list_items" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"game_id" text NOT NULL,
	"added_at" bigint DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);
--> statement-breakpoint
CREATE TABLE "game_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
	"updated_at" bigint DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);
--> statement-breakpoint
ALTER TABLE "game_list_items" ADD CONSTRAINT "game_list_items_list_id_game_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."game_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_list_items" ADD CONSTRAINT "game_list_items_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_lists" ADD CONSTRAINT "game_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_list_items_list_game_idx" ON "game_list_items" USING btree ("list_id","game_id");--> statement-breakpoint
CREATE INDEX "game_list_items_game_idx" ON "game_list_items" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_lists_user_name_idx" ON "game_lists" USING btree ("user_id","name");
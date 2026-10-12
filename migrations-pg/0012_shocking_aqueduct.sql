ALTER TABLE "user_settings" ADD COLUMN "release_scoring_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "release_scoring_profile" text;
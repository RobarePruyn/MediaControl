-- Step 1: Create user_venues table
CREATE TABLE "user_venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_venues" ADD CONSTRAINT "user_venues_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_venues" ADD CONSTRAINT "user_venues_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_venues_user_id_idx" ON "user_venues" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_venues_venue_id_idx" ON "user_venues" USING btree ("venue_id");--> statement-breakpoint

-- Step 2: Add custom_domain to venues
ALTER TABLE "venues" ADD COLUMN "custom_domain" varchar(255);--> statement-breakpoint

-- Step 3: Add new enum values to user_role (safe — ADD VALUE is non-destructive)
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'super_admin';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'app_admin';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'venue_super_admin';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'venue_operator';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'end_user';--> statement-breakpoint

-- Step 4: Migrate existing role data to new values
UPDATE "users" SET "role" = 'super_admin' WHERE "role" = 'meta_admin';--> statement-breakpoint
UPDATE "users" SET "role" = 'app_admin' WHERE "role" = 'site_admin';--> statement-breakpoint
UPDATE "users" SET "role" = 'venue_operator' WHERE "role" = 'operator';--> statement-breakpoint

-- Step 5: Update default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'venue_operator';

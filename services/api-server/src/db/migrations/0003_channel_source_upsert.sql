ALTER TABLE "channels" ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'manual';--> statement-breakpoint
-- Remove duplicate channels before adding unique constraint (keep the oldest per venue+platformChannelId)
DELETE FROM "channels" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "venue_id", "platform_channel_id" ORDER BY "created_at" ASC) AS rn
    FROM "channels"
  ) dupes WHERE rn > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "channels_venue_platform_id_uniq" ON "channels" USING btree ("venue_id","platform_channel_id");

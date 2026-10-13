ALTER TABLE "blocks" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_id_uq" ON "blocks" USING btree ("id");
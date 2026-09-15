UPDATE "document_participants"
SET "is_required" = true
WHERE "is_required" IS NULL;--> statement-breakpoint

ALTER TABLE "document_participants" ALTER COLUMN "is_required" SET NOT NULL;

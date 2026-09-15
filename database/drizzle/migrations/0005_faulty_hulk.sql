ALTER TABLE "document_templates" ALTER COLUMN "creator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;
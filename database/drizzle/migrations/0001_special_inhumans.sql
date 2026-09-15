ALTER TABLE "documents" ADD COLUMN "status" "document_status" DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_access_token_unique" UNIQUE("access_token");
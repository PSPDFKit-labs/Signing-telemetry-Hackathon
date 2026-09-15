CREATE TYPE "public"."document_signing_method" AS ENUM('ELECTRONIC', 'WET');--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'AWAITING_WET_SIGNATURE' BEFORE 'DECLINED';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "signing_method" "document_signing_method" DEFAULT 'ELECTRONIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "wet_signed_returned_at" timestamp;
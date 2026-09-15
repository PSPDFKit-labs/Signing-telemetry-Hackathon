-- Add CANCELLED status to signature_status enum
ALTER TYPE "signature_status" ADD VALUE IF NOT EXISTS 'CANCELLED';--> statement-breakpoint

-- Add CANCELLED status to document_status enum
ALTER TYPE "document_status" ADD VALUE IF NOT EXISTS 'CANCELLED';

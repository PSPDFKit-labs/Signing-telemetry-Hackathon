-- Add require_sequential_signing column to documents table
ALTER TABLE "documents" ADD COLUMN "require_sequential_signing" boolean DEFAULT false;

-- Add access_token column to signature_requests table
-- This stores the secure token used in email signing links

ALTER TABLE signature_requests
ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_signature_requests_access_token
ON signature_requests(access_token);

-- Update existing signature requests with tokens (for any existing data)
-- This is safe because it only updates rows where access_token is NULL
UPDATE signature_requests
SET access_token = gen_random_uuid()::text
WHERE access_token IS NULL;

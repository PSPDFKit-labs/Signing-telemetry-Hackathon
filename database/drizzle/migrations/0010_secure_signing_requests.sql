WITH ranked_requests AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "document_id", "participant_id"
      ORDER BY
        CASE "status"
          WHEN 'SIGNED' THEN 0
          WHEN 'PENDING' THEN 1
          ELSE 2
        END,
        "requested_at" DESC NULLS LAST,
        "id"
    ) AS duplicate_rank
  FROM "signature_requests"
)
DELETE FROM "signature_requests"
WHERE "id" IN (
  SELECT "id" FROM ranked_requests WHERE duplicate_rank > 1
);--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

UPDATE "signature_requests"
SET "access_token" = 'sha256:' || encode(digest("access_token", 'sha256'), 'hex')
WHERE "access_token" IS NOT NULL
  AND "access_token" NOT LIKE 'sha256:%';--> statement-breakpoint

ALTER TABLE "signature_requests"
ADD CONSTRAINT "signature_requests_document_participant_unique"
UNIQUE("document_id", "participant_id");

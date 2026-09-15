-- Add status and deletion tracking to documents table
ALTER TABLE documents
ADD COLUMN status document_status DEFAULT 'DRAFT',
ADD COLUMN deleted_at timestamp;

-- Add index for faster queries on status and deleted documents
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NOT NULL;

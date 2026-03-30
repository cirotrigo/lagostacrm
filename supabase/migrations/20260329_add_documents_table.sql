-- ==============================================
-- Migration: Create documents table for knowledge base (pgvector)
-- Used by n8n vector store tool for Sofia AI agent
-- ==============================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create documents table (compatible with n8n Supabase Vector Store node)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(1536),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Create index for organization filtering
CREATE INDEX IF NOT EXISTS idx_documents_org
  ON documents (organization_id);

-- 5. Create index for metadata filtering
CREATE INDEX IF NOT EXISTS idx_documents_metadata
  ON documents USING gin (metadata);

-- 6. Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policy: users can only see documents from their organization
CREATE POLICY "documents_org_isolation" ON documents
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 8. Service role can access all documents (for n8n)
CREATE POLICY "documents_service_role" ON documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 9. Match function for vector similarity search (used by n8n Supabase Vector Store node)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.metadata @> filter
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

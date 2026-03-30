-- =============================================================================
-- AI Training / RAG - Base de Conhecimento do Agente
-- LagostaCRM
-- Migration: 20260217000000_ai_training_rag.sql
-- =============================================================================

-- 1. Extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. Tabela de metadados (gerenciada pelo CRM)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_training_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    type TEXT NOT NULL CHECK (type IN ('pdf', 'text', 'qa')),
    title TEXT NOT NULL,
    content TEXT,
    source_file_url TEXT,
    source_file_name TEXT,

    question TEXT,
    answer TEXT,

    metadata JSONB DEFAULT '{}',

    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'error')),
    error_message TEXT,
    chunk_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atd_org ON public.ai_training_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_atd_org_status ON public.ai_training_documents(organization_id, status);

ALTER TABLE public.ai_training_documents ENABLE ROW LEVEL SECURITY;

-- RLS Padrão B (admin gerencia, membros leem)
DROP POLICY IF EXISTS "Admins can manage training docs" ON public.ai_training_documents;
DROP POLICY IF EXISTS "Members can view training docs" ON public.ai_training_documents;

CREATE POLICY "Admins can manage training docs"
    ON public.ai_training_documents FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = ai_training_documents.organization_id
            AND p.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = ai_training_documents.organization_id
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Members can view training docs"
    ON public.ai_training_documents FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = ai_training_documents.organization_id
        )
    );

-- Trigger updated_at
CREATE TRIGGER update_ai_training_docs_updated_at
    BEFORE UPDATE ON public.ai_training_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. Tabela `documents` — compatibilidade n8n (TABELA REAL, não VIEW)
-- O node vectorStoreSupabase SEMPRE usa tabela "documents" (bug #12906)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),

    -- FKs para rastreabilidade (não exigidas pelo n8n)
    training_doc_id UUID REFERENCES public.ai_training_documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index vetorial (lists=10 para < 10k rows)
CREATE INDEX IF NOT EXISTS idx_documents_embedding
    ON public.documents
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_training_doc ON public.documents(training_doc_id);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON public.documents USING gin(metadata);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Padrão A (n8n acessa via service_role, frontend só lê)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.documents;

CREATE POLICY "Enable all access for authenticated users"
    ON public.documents FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- =============================================================================
-- 4. Function match_documents — assinatura obrigatória para n8n/LangChain
-- =============================================================================
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_count int DEFAULT NULL,
    filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT
        id,
        content,
        metadata,
        1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE metadata @> filter
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_documents(vector, int, jsonb) TO anon, authenticated;

-- =============================================================================
-- 5. Storage bucket
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ai-training', 'ai-training', false, 20971520)  -- 20MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = 20971520;

-- Storage policies (idempotente)
DROP POLICY IF EXISTS "ai_training_upload" ON storage.objects;
DROP POLICY IF EXISTS "ai_training_read" ON storage.objects;
DROP POLICY IF EXISTS "ai_training_delete" ON storage.objects;

CREATE POLICY "ai_training_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ai-training');

CREATE POLICY "ai_training_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'ai-training');

CREATE POLICY "ai_training_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'ai-training');

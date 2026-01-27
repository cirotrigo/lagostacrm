-- =============================================================================
-- Migration: Import XLSX Tables (JucãoCRM Feature)
-- Created: 2026-01-27
-- Description: Cria tabelas para suportar importação de produtos via XLSX
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ÍNDICE ÚNICO DE SKU POR ORGANIZAÇÃO
-- Necessário para UPSERT funcionar corretamente
-- -----------------------------------------------------------------------------

-- Primeiro, remover duplicatas se existirem (mantém o mais recente)
DELETE FROM products p1
USING products p2
WHERE p1.organization_id = p2.organization_id
  AND p1.sku = p2.sku
  AND p1.sku IS NOT NULL
  AND p1.created_at < p2.created_at;

-- Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_sku
ON products(organization_id, sku)
WHERE sku IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. TABELA IMPORT_JOBS
-- Rastreia jobs de importação de arquivos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Status do job
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'parsing', 'staging', 'processing', 'completed', 'failed', 'cancelled')),

  -- Arquivo
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_size INT,

  -- Contadores
  total_rows INT DEFAULT 0,
  processed_rows INT DEFAULT 0,
  created_count INT DEFAULT 0,
  updated_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  error_count INT DEFAULT 0,

  -- Erro
  last_error TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created ON import_jobs(created_at DESC);

-- RLS
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Política: usuários só veem jobs da própria organização
CREATE POLICY "Users can view own org import jobs"
ON import_jobs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Política: usuários podem criar jobs na própria organização
CREATE POLICY "Users can create import jobs in own org"
ON import_jobs FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- Política: service_role pode tudo (para N8N)
CREATE POLICY "Service role full access to import_jobs"
ON import_jobs FOR ALL
USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 3. TABELA IMPORT_STAGING
-- Dados parseados aguardando processamento pelo N8N
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,

  -- Dados do produto
  row_index INT NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  description TEXT,

  -- Status de processamento
  processed BOOLEAN DEFAULT false,
  error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance do N8N
CREATE INDEX IF NOT EXISTS idx_staging_job ON import_staging(job_id);
CREATE INDEX IF NOT EXISTS idx_staging_unprocessed ON import_staging(job_id) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_staging_row ON import_staging(job_id, row_index);

-- RLS (staging é acessado pelo service_role via N8N)
ALTER TABLE import_staging ENABLE ROW LEVEL SECURITY;

-- Política: service_role pode tudo
CREATE POLICY "Service role full access to import_staging"
ON import_staging FOR ALL
USING (auth.role() = 'service_role');

-- Política: usuários podem ver staging dos jobs da própria org
CREATE POLICY "Users can view own org staging"
ON import_staging FOR SELECT
USING (
  job_id IN (
    SELECT id FROM import_jobs WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
);

-- -----------------------------------------------------------------------------
-- 4. FUNÇÃO PARA ATUALIZAR updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_import_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_import_jobs_updated_at();

-- -----------------------------------------------------------------------------
-- 5. COMENTÁRIOS
-- -----------------------------------------------------------------------------

COMMENT ON TABLE import_jobs IS 'Jobs de importação de arquivos XLSX (feature JucãoCRM)';
COMMENT ON TABLE import_staging IS 'Dados parseados aguardando processamento pelo N8N';
COMMENT ON INDEX idx_products_org_sku IS 'Índice único SKU por organização para UPSERT';

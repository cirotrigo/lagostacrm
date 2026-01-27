-- =============================================================================
-- Migration: Fix Products SKU Constraint
-- Created: 2026-01-27
-- Description: Substitui índice parcial por constraint UNIQUE para funcionar com UPSERT
-- =============================================================================

-- Remover o índice parcial antigo (se existir)
DROP INDEX IF EXISTS idx_products_org_sku;

-- Criar constraint UNIQUE em vez de índice parcial
-- Nota: NULL values são tratados como únicos em PostgreSQL, então múltiplos NULLs são permitidos
ALTER TABLE products
ADD CONSTRAINT products_org_sku_unique
UNIQUE (organization_id, sku);

COMMENT ON CONSTRAINT products_org_sku_unique ON products IS 'Constraint único SKU por organização para UPSERT';

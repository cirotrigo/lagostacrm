-- =============================================================================
-- Migration: 20260216000000_org_branding.sql
-- Branding dinâmico por organização
-- Permite que cada deploy (cliente) tenha nome, logo e cores customizados
-- sem precisar de branch separada ou CLIENT_ID em env var
-- =============================================================================

-- Adiciona colunas de branding à tabela organization_settings
ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS brand_name TEXT DEFAULT 'NossoCRM',
    ADD COLUMN IF NOT EXISTS brand_short_name TEXT,
    ADD COLUMN IF NOT EXISTS brand_initial TEXT,
    ADD COLUMN IF NOT EXISTS brand_description TEXT,
    ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
    ADD COLUMN IF NOT EXISTS brand_favicon_url TEXT,
    ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#3B82F6',
    ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.organization_settings.brand_name IS 'Nome completo da marca (ex: CRM Coronel, SosPet)';
COMMENT ON COLUMN public.organization_settings.brand_short_name IS 'Nome curto para mobile (fallback: brand_name)';
COMMENT ON COLUMN public.organization_settings.brand_initial IS 'Letra inicial para avatar/logo (fallback: primeira letra de brand_name)';
COMMENT ON COLUMN public.organization_settings.brand_description IS 'Descrição para SEO e meta tags';
COMMENT ON COLUMN public.organization_settings.brand_logo_url IS 'URL do logo (storage do Supabase ou CDN)';
COMMENT ON COLUMN public.organization_settings.brand_favicon_url IS 'URL do favicon (storage do Supabase ou CDN)';
COMMENT ON COLUMN public.organization_settings.brand_primary_color IS 'Cor primária hex (ex: #3B82F6)';
COMMENT ON COLUMN public.organization_settings.custom_domain IS 'Domínio customizado (ex: crm.coronelpicanha.com.br)';

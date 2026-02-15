-- =============================================================================
-- Migration: Branding dinâmico por organização
-- Permite configurar marca, logo e cores por cliente via banco de dados
-- =============================================================================

-- Adicionar colunas de branding na tabela organization_settings
ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS brand_name TEXT,
    ADD COLUMN IF NOT EXISTS brand_short_name TEXT,
    ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
    ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
    ADD COLUMN IF NOT EXISTS brand_description TEXT,
    ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.organization_settings.brand_name IS 'Nome completo da marca exibido no CRM (ex: CRM Coronel, SosPet)';
COMMENT ON COLUMN public.organization_settings.brand_short_name IS 'Nome curto para mobile e PWA (ex: Coronel, SosPet)';
COMMENT ON COLUMN public.organization_settings.brand_logo_url IS 'URL do logo customizado (Supabase Storage ou CDN externo)';
COMMENT ON COLUMN public.organization_settings.brand_primary_color IS 'Cor primária em hex (ex: #16a34a) para tema do CRM';
COMMENT ON COLUMN public.organization_settings.brand_description IS 'Descrição para SEO e manifest PWA';
COMMENT ON COLUMN public.organization_settings.custom_domain IS 'Domínio customizado do cliente (ex: crm.restaurante.com.br)';

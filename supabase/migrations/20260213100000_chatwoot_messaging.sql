-- =============================================================================
-- Chatwoot Integration Schema
-- LagostaCRM - Mensageria Omnichannel via Chatwoot
-- Migration: 20260213100000_chatwoot_messaging.sql
-- =============================================================================

-- ============================================================================
-- TABELA: messaging_channel_configs
-- Configuracoes de canais conectados (Chatwoot + WPPConnect)
-- RLS: Padrao B (admin gerencia, membros leem)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Chatwoot
    chatwoot_base_url TEXT NOT NULL,
    chatwoot_api_token TEXT NOT NULL,
    chatwoot_account_id INTEGER NOT NULL,
    chatwoot_inbox_id INTEGER,

    -- WPPConnect (para labels sync)
    wppconnect_base_url TEXT,
    wppconnect_token TEXT,
    wppconnect_session TEXT,

    -- Metadata
    channel_type TEXT DEFAULT 'whatsapp',
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_mcc_org_status ON public.messaging_channel_configs(organization_id, status);

-- RLS (Padrao B - Admin only para gerenciar)
ALTER TABLE public.messaging_channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channel configs"
    ON public.messaging_channel_configs
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_channel_configs.organization_id
            AND p.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_channel_configs.organization_id
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Members can view channel configs"
    ON public.messaging_channel_configs
    FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_channel_configs.organization_id
        )
    );

-- ============================================================================
-- TABELA: messaging_conversation_links
-- Vinculacao CRM <-> Chatwoot (com preview para timeline)
-- RLS: Padrao A (todos autenticados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_conversation_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- IDs do Chatwoot
    chatwoot_conversation_id INTEGER NOT NULL,
    chatwoot_contact_id INTEGER,
    chatwoot_inbox_id INTEGER,

    -- Vinculacao com CRM
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,

    -- Preview para timeline (evita chamadas a API do Chatwoot)
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    last_message_sender TEXT CHECK (last_message_sender IN ('customer', 'agent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'pending')),
    unread_count INTEGER DEFAULT 0,

    -- Deep link para abrir no Chatwoot (preenchido pela aplicacao/webhook)
    chatwoot_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, chatwoot_conversation_id)
);

-- Indices de performance
CREATE INDEX IF NOT EXISTS idx_mcl_org ON public.messaging_conversation_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_mcl_contact ON public.messaging_conversation_links(contact_id)
    WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcl_deal ON public.messaging_conversation_links(deal_id)
    WHERE deal_id IS NOT NULL;

-- Indices compostos para timeline queries
CREATE INDEX IF NOT EXISTS idx_mcl_contact_last_msg
    ON public.messaging_conversation_links(contact_id, last_message_at DESC)
    WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcl_deal_last_msg
    ON public.messaging_conversation_links(deal_id, last_message_at DESC)
    WHERE deal_id IS NOT NULL;

-- Indice para buscar conversas abertas
CREATE INDEX IF NOT EXISTS idx_mcl_status_open
    ON public.messaging_conversation_links(organization_id, status)
    WHERE status = 'open';

-- RLS (Padrao A - Todos autenticados)
ALTER TABLE public.messaging_conversation_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_conversation_links
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABELA: messaging_label_map
-- Mapeamento: Tag CRM <-> Label Chatwoot <-> Label WhatsApp
-- RLS: Padrao B (admin gerencia, membros leem)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_label_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Identificadores
    crm_tag_name TEXT NOT NULL,
    chatwoot_label TEXT NOT NULL,
    whatsapp_label TEXT,

    -- Vinculacao com stage (opcional - para auto-tag)
    board_stage_id UUID REFERENCES public.board_stages(id) ON DELETE SET NULL,

    -- Cor para consistencia visual
    color TEXT DEFAULT '#6B7280',

    -- Direcao de sync
    sync_to_chatwoot BOOLEAN DEFAULT true,
    sync_to_whatsapp BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, crm_tag_name)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_mlm_org ON public.messaging_label_map(organization_id);
CREATE INDEX IF NOT EXISTS idx_mlm_stage ON public.messaging_label_map(board_stage_id)
    WHERE board_stage_id IS NOT NULL;

-- RLS (Padrao B - Admin only para gerenciar)
ALTER TABLE public.messaging_label_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage label mappings"
    ON public.messaging_label_map
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_label_map.organization_id
            AND p.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_label_map.organization_id
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Members can view label mappings"
    ON public.messaging_label_map
    FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_label_map.organization_id
        )
    );

-- ============================================================================
-- TABELA: messaging_label_sync_log
-- Auditoria de sincronizacoes de labels
-- RLS: Padrao A (todos autenticados podem ler)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_label_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Contexto
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    conversation_link_id UUID REFERENCES public.messaging_conversation_links(id) ON DELETE SET NULL,

    -- Acao
    action TEXT NOT NULL CHECK (action IN ('add_label', 'remove_label', 'sync_error')),
    label_name TEXT NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('chatwoot', 'whatsapp', 'crm')),

    -- Resultado
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Metadata
    triggered_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_mlsl_org_created ON public.messaging_label_sync_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mlsl_deal ON public.messaging_label_sync_log(deal_id) WHERE deal_id IS NOT NULL;

-- RLS (Padrao A)
ALTER TABLE public.messaging_label_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_label_sync_log
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TRIGGER: Auto-tag deal quando muda de stage
-- Adiciona a tag correspondente ao stage no deals.tags[]
-- NOTA: Usa COALESCE(label, name) para pegar o display name correto
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_tag_deal_on_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_display TEXT;
    v_label_map RECORD;
BEGIN
    -- So executa se stage_id mudou
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id AND NEW.stage_id IS NOT NULL THEN

        -- Buscar display name do stage (label com fallback para name)
        SELECT COALESCE(bs.label, bs.name) INTO v_stage_display
        FROM public.board_stages bs
        WHERE bs.id = NEW.stage_id;

        -- Buscar mapeamento de label para este stage
        SELECT * INTO v_label_map
        FROM public.messaging_label_map
        WHERE board_stage_id = NEW.stage_id
        LIMIT 1;

        -- Se existe mapeamento, adicionar tag ao deal
        IF v_label_map.id IS NOT NULL THEN
            -- Adicionar tag se nao existe
            IF NOT (NEW.tags @> ARRAY[v_label_map.crm_tag_name]) THEN
                NEW.tags := array_append(COALESCE(NEW.tags, ARRAY[]::TEXT[]), v_label_map.crm_tag_name);
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger BEFORE UPDATE (para modificar NEW.tags)
DROP TRIGGER IF EXISTS trg_auto_tag_deal_on_stage ON public.deals;
CREATE TRIGGER trg_auto_tag_deal_on_stage
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auto_tag_deal_on_stage_change();

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- NOTA: Usa update_updated_at_column() (nome correto da funcao no NossoCRM)
-- ============================================================================
CREATE TRIGGER set_updated_at_messaging_channel_configs
    BEFORE UPDATE ON public.messaging_channel_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_messaging_conversation_links
    BEFORE UPDATE ON public.messaging_conversation_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_messaging_label_map
    BEFORE UPDATE ON public.messaging_label_map
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Realtime - Habilitar publicacao para as novas tabelas
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_conversation_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_label_sync_log;

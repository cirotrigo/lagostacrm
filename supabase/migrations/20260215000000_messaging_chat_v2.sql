-- =============================================================================
-- Messaging Chat V2 Schema
-- LagostaCRM - Chat Completo Embutido via Chatwoot
-- Migration: 20260215000000_messaging_chat_v2.sql
-- =============================================================================
-- This migration adds the tables and functions needed for the embedded chat
-- feature, allowing the CRM to be the primary interface for customer messaging.
-- =============================================================================

-- ============================================================================
-- TABELA: messaging_messages_cache
-- Cache local de mensagens para realtime sync
-- O Chatwoot continua sendo a fonte de verdade
-- RLS: Padrao A (todos autenticados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_messages_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- IDs do Chatwoot
    chatwoot_message_id INTEGER NOT NULL,
    chatwoot_conversation_id INTEGER NOT NULL,

    -- Conteudo
    content TEXT,
    content_type TEXT DEFAULT 'text',
    message_type TEXT NOT NULL CHECK (message_type IN ('incoming', 'outgoing', 'activity')),
    is_private BOOLEAN DEFAULT false,

    -- Anexos (JSON array)
    attachments JSONB DEFAULT '[]'::jsonb,

    -- Remetente
    sender_type TEXT CHECK (sender_type IN ('contact', 'user', 'agent_bot')),
    sender_id INTEGER,
    sender_name TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint para evitar duplicatas
    UNIQUE(organization_id, chatwoot_message_id)
);

-- Indices de performance
CREATE INDEX IF NOT EXISTS idx_mmc_org_conv
    ON public.messaging_messages_cache(organization_id, chatwoot_conversation_id);

CREATE INDEX IF NOT EXISTS idx_mmc_conv_created
    ON public.messaging_messages_cache(chatwoot_conversation_id, created_at DESC);

-- Indice para busca de mensagens recentes
CREATE INDEX IF NOT EXISTS idx_mmc_org_created
    ON public.messaging_messages_cache(organization_id, created_at DESC);

-- RLS (Padrao A - Todos autenticados)
ALTER TABLE public.messaging_messages_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_messages_cache
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABELA: messaging_agents
-- Cache de agentes Chatwoot mapeados para profiles do CRM
-- RLS: Padrao A (todos autenticados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Mapeamento para profile (opcional - agente pode existir so no Chatwoot)
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- IDs do Chatwoot
    chatwoot_agent_id INTEGER NOT NULL,
    chatwoot_agent_name TEXT,
    chatwoot_agent_email TEXT,

    -- Status
    availability TEXT DEFAULT 'offline' CHECK (availability IN ('online', 'offline', 'busy')),
    last_seen_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint para evitar duplicatas
    UNIQUE(organization_id, chatwoot_agent_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_ma_org ON public.messaging_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ma_profile ON public.messaging_agents(profile_id)
    WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ma_availability ON public.messaging_agents(organization_id, availability)
    WHERE availability = 'online';

-- RLS (Padrao A)
ALTER TABLE public.messaging_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_agents
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- ALTER: messaging_conversation_links - Campos adicionais
-- Adiciona campos para assignment, inbox info e contato info
-- ============================================================================
ALTER TABLE public.messaging_conversation_links
    ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER,
    ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT,
    ADD COLUMN IF NOT EXISTS inbox_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS contact_avatar_url TEXT;

-- Indice para buscar por agente atribuido
CREATE INDEX IF NOT EXISTS idx_mcl_assigned_agent
    ON public.messaging_conversation_links(organization_id, assigned_agent_id)
    WHERE assigned_agent_id IS NOT NULL;

-- ============================================================================
-- FUNCTION: increment_unread_count
-- Incrementa o contador de unread de uma conversa
-- Usada pelo webhook quando uma nova mensagem incoming chega
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_unread_count(
    p_organization_id UUID,
    p_chatwoot_conversation_id INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.messaging_conversation_links
    SET
        unread_count = unread_count + 1,
        updated_at = NOW()
    WHERE organization_id = p_organization_id
      AND chatwoot_conversation_id = p_chatwoot_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: reset_unread_count
-- Reseta o contador de unread para zero
-- Usada quando o usuario visualiza a conversa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reset_unread_count(
    p_organization_id UUID,
    p_chatwoot_conversation_id INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.messaging_conversation_links
    SET
        unread_count = 0,
        updated_at = NOW()
    WHERE organization_id = p_organization_id
      AND chatwoot_conversation_id = p_chatwoot_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: upsert_message_cache
-- Insere ou atualiza uma mensagem no cache
-- Usada pelo webhook para processar message_created events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_message_cache(
    p_organization_id UUID,
    p_chatwoot_message_id INTEGER,
    p_chatwoot_conversation_id INTEGER,
    p_content TEXT,
    p_content_type TEXT,
    p_message_type TEXT,
    p_is_private BOOLEAN,
    p_attachments JSONB,
    p_sender_type TEXT,
    p_sender_id INTEGER,
    p_sender_name TEXT,
    p_created_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
BEGIN
    INSERT INTO public.messaging_messages_cache (
        organization_id,
        chatwoot_message_id,
        chatwoot_conversation_id,
        content,
        content_type,
        message_type,
        is_private,
        attachments,
        sender_type,
        sender_id,
        sender_name,
        created_at
    ) VALUES (
        p_organization_id,
        p_chatwoot_message_id,
        p_chatwoot_conversation_id,
        p_content,
        COALESCE(p_content_type, 'text'),
        p_message_type,
        COALESCE(p_is_private, false),
        COALESCE(p_attachments, '[]'::jsonb),
        p_sender_type,
        p_sender_id,
        p_sender_name,
        COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (organization_id, chatwoot_message_id)
    DO UPDATE SET
        content = EXCLUDED.content,
        content_type = EXCLUDED.content_type,
        attachments = EXCLUDED.attachments,
        updated_at = NOW()
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: update_conversation_link_from_message
-- Atualiza o preview da conversa quando uma nova mensagem chega
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_conversation_link_from_message(
    p_organization_id UUID,
    p_chatwoot_conversation_id INTEGER,
    p_content TEXT,
    p_message_type TEXT,
    p_created_at TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
    v_sender TEXT;
BEGIN
    -- Determina o sender com base no tipo de mensagem
    IF p_message_type = 'incoming' THEN
        v_sender := 'customer';
    ELSE
        v_sender := 'agent';
    END IF;

    UPDATE public.messaging_conversation_links
    SET
        last_message_at = COALESCE(p_created_at, NOW()),
        last_message_preview = LEFT(p_content, 100),
        last_message_sender = v_sender,
        updated_at = NOW()
    WHERE organization_id = p_organization_id
      AND chatwoot_conversation_id = p_chatwoot_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER set_updated_at_messaging_messages_cache
    BEFORE UPDATE ON public.messaging_messages_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_messaging_agents
    BEFORE UPDATE ON public.messaging_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Realtime - Habilitar publicacao para as novas tabelas
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_messages_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_agents;

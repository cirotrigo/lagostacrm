-- ============================================================================
-- Migration: AI Handoff State
-- Adds ai_enabled as the canonical source of truth for IA<->Human handoff,
-- replacing the indirect derivation from Chatwoot labels.
--
-- Rationale:
-- Previously, `ai_enabled` was computed at render time from
-- `conversation.labels?.includes('atendimento-humano')` fetched from Chatwoot
-- (via GET /conversations). That approach had three issues:
--   1. 30-60s cache on the frontend (staleTime/refetchInterval)
--   2. No realtime propagation when labels changed externally (n8n auto-assign)
--   3. The n8n agent had no local fast-path to check before responding
--
-- This migration promotes ai_enabled to a persisted column on
-- messaging_conversation_links, which is already published to supabase_realtime.
-- A single write to this column triggers instant UI updates across all clients.
-- ============================================================================

ALTER TABLE public.messaging_conversation_links
    ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
    ADD COLUMN IF NOT EXISTS handoff_source TEXT
        CHECK (handoff_source IS NULL OR handoff_source IN ('ui', 'agent', 'echo_ig', 'echo_wa', 'webhook', 'api')),
    ADD COLUMN IF NOT EXISTS handoff_at TIMESTAMPTZ;

-- Index for fast lookup of conversations in human mode
CREATE INDEX IF NOT EXISTS idx_mcl_ai_enabled
    ON public.messaging_conversation_links(organization_id, ai_enabled)
    WHERE ai_enabled = FALSE;

-- Comment for documentation
COMMENT ON COLUMN public.messaging_conversation_links.ai_enabled IS
    'Canonical handoff state. TRUE=AI bot responds, FALSE=human mode (bot paused). Source of truth for n8n Filtro_Inicial and CRM UI toggle.';
COMMENT ON COLUMN public.messaging_conversation_links.handoff_reason IS
    'Human-readable reason for the last handoff transition (e.g. "client_requested", "manual_reply", "agent_decision").';
COMMENT ON COLUMN public.messaging_conversation_links.handoff_source IS
    'Which subsystem triggered the last handoff: ui (CRM toggle), agent (n8n tool), echo_ig/echo_wa (manual reply detected), webhook (external), api.';
COMMENT ON COLUMN public.messaging_conversation_links.handoff_at IS
    'Timestamp of the last handoff transition.';

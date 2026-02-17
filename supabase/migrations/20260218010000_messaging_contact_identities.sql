-- =============================================================================
-- Messaging Contact Identities Schema
-- LagostaCRM - Multi-Channel Identity Resolution
-- Migration: 20260218010000_messaging_contact_identities.sql
-- =============================================================================
--
-- Purpose: Map external channel identifiers (Instagram IGSID, WhatsApp phone)
--          to CRM contacts for deterministic identity resolution.
--
-- Design Principles:
--   - Additive and fork-safe (new table, no changes to existing schema)
--   - Multi-tenant isolation via organization_id
--   - Idempotent upserts via UNIQUE constraint
--   - RLS Pattern A (all authenticated users)
-- =============================================================================

-- ============================================================================
-- TABLE: messaging_contact_identities
-- Maps external channel identities to CRM contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_contact_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization isolation (multi-tenant)
    organization_id UUID NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- CRM contact reference (cascade delete if contact is removed)
    contact_id UUID NOT NULL
        REFERENCES public.contacts(id) ON DELETE CASCADE,

    -- Channel source (logical enum: WHATSAPP, INSTAGRAM)
    -- Using TEXT with CHECK for flexibility and explicit validation
    source TEXT NOT NULL
        CHECK (source IN ('WHATSAPP', 'INSTAGRAM')),

    -- External identifier from the messaging platform:
    --   - WhatsApp: E.164 phone number (e.g., +5511999990000)
    --   - Instagram: IGSID (e.g., 17841400000000000)
    external_id TEXT NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Idempotency constraint: one external identity per source per org
    -- This prevents duplicate records and allows safe upserts
    UNIQUE(organization_id, source, external_id)
);

-- ============================================================================
-- INDICES
-- Performance optimization for common query patterns
-- ============================================================================

-- Index for looking up all identities for a contact
CREATE INDEX IF NOT EXISTS idx_mci_org_contact
    ON public.messaging_contact_identities(organization_id, contact_id);

-- Index for filtering by source (e.g., find all Instagram identities)
CREATE INDEX IF NOT EXISTS idx_mci_org_source
    ON public.messaging_contact_identities(organization_id, source);

-- Index for contact deletion cascades
CREATE INDEX IF NOT EXISTS idx_mci_contact
    ON public.messaging_contact_identities(contact_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Pattern A: All authenticated users (same as messaging_conversation_links)
-- ============================================================================
ALTER TABLE public.messaging_contact_identities ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
-- Note: Additional application-level checks ensure organization isolation
CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_contact_identities
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- Uses existing function from schema_init
-- ============================================================================
CREATE TRIGGER set_updated_at_messaging_contact_identities
    BEFORE UPDATE ON public.messaging_contact_identities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- REALTIME: Enable subscription for live updates
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_contact_identities;

-- ============================================================================
-- COMMENTS: Documentation for schema introspection
-- ============================================================================
COMMENT ON TABLE public.messaging_contact_identities IS
    'Maps external messaging identities (Instagram, WhatsApp) to CRM contacts';

COMMENT ON COLUMN public.messaging_contact_identities.source IS
    'Channel source: WHATSAPP or INSTAGRAM';

COMMENT ON COLUMN public.messaging_contact_identities.external_id IS
    'External identifier: E.164 phone for WhatsApp, IGSID for Instagram';

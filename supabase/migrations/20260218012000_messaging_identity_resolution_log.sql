-- =============================================================================
-- Messaging Identity Resolution Log
-- LagostaCRM - Audit Trail for Identity Resolution
-- Migration: 20260218012000_messaging_identity_resolution_log.sql
-- =============================================================================
--
-- Purpose: Audit trail for identity resolution operations. Useful for:
--   - Debugging ambiguous resolutions
--   - Tracking fallback usage patterns
--   - Identifying contacts that need manual review
--   - Compliance and data governance
--
-- Design Principles:
--   - Optional but recommended for production
--   - Append-only log (no updates/deletes in normal operation)
--   - Soft references to allow resolution logging even when entities don't exist
-- =============================================================================

-- ============================================================================
-- TABLE: messaging_identity_resolution_log
-- Audit trail for identity resolution operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_identity_resolution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization isolation
    organization_id UUID NOT NULL
        REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Resolution context
    source TEXT NOT NULL
        CHECK (source IN ('WHATSAPP', 'INSTAGRAM')),
    external_id TEXT NOT NULL,

    -- Resolution result action
    action TEXT NOT NULL
        CHECK (action IN (
            'created',           -- New contact and identity created
            'matched',           -- Matched existing identity in table
            'fallback_phone',    -- Fell back to phone lookup
            'fallback_email',    -- Fell back to email lookup
            'ambiguous',         -- Multiple matches found (manual review needed)
            'not_found',         -- No match found, no auto-create
            'error'              -- Resolution error (see error_message)
        )),

    -- Related entities (nullable for failed resolutions)
    contact_id UUID
        REFERENCES public.contacts(id) ON DELETE SET NULL,
    identity_id UUID
        REFERENCES public.messaging_contact_identities(id) ON DELETE SET NULL,

    -- Additional context for debugging/auditing
    metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,

    -- Request context (for tracing)
    request_id TEXT,
    user_agent TEXT,

    -- Timestamp (append-only, no updated_at needed)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDICES
-- Optimized for audit queries and debugging
-- ============================================================================

-- Primary audit query: by org + time range
CREATE INDEX IF NOT EXISTS idx_mirl_org_created
    ON public.messaging_identity_resolution_log(organization_id, created_at DESC);

-- Debugging: find all resolutions for a specific external_id
CREATE INDEX IF NOT EXISTS idx_mirl_external_id
    ON public.messaging_identity_resolution_log(organization_id, source, external_id);

-- Error monitoring: find all errors for an org
CREATE INDEX IF NOT EXISTS idx_mirl_errors
    ON public.messaging_identity_resolution_log(organization_id, action, created_at DESC)
    WHERE action IN ('error', 'ambiguous', 'not_found');

-- Contact history: all resolutions that touched a contact
CREATE INDEX IF NOT EXISTS idx_mirl_contact
    ON public.messaging_identity_resolution_log(contact_id)
    WHERE contact_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Pattern A: All authenticated users (read access for audit)
-- ============================================================================
ALTER TABLE public.messaging_identity_resolution_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_identity_resolution_log
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- RETENTION HELPER: Function to clean old logs
-- Not scheduled by default; run manually or via cron if needed
-- ============================================================================
CREATE OR REPLACE FUNCTION messaging_cleanup_resolution_logs(
    older_than_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.messaging_identity_resolution_log
    WHERE created_at < NOW() - (older_than_days || ' days')::INTERVAL
        AND action NOT IN ('error', 'ambiguous'); -- Keep errors for longer

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================
COMMENT ON TABLE public.messaging_identity_resolution_log IS
    'Audit trail for identity resolution operations (debugging, compliance)';

COMMENT ON COLUMN public.messaging_identity_resolution_log.action IS
    'Resolution outcome: created, matched, fallback_phone, fallback_email, ambiguous, not_found, error';

COMMENT ON COLUMN public.messaging_identity_resolution_log.metadata IS
    'Additional context: phone/email tried, resolution timing, etc.';

COMMENT ON FUNCTION messaging_cleanup_resolution_logs IS
    'Remove old resolution logs (default: 90 days). Keeps errors and ambiguous for review.';

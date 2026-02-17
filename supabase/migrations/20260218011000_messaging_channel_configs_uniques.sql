-- =============================================================================
-- Messaging Channel Configs - Uniqueness Constraints
-- LagostaCRM - Multi-Channel Disambiguation
-- Migration: 20260218011000_messaging_channel_configs_uniques.sql
-- =============================================================================
--
-- Purpose: Add constraints and indices to prevent ambiguity when querying
--          channel configurations. Fixes `.single()` errors when multiple
--          active configs exist for the same channel type.
--
-- Design Principles:
--   - Additive (only adds indices, no schema changes)
--   - Partial indices for active configs only
--   - Optimizes common webhook lookup patterns
-- =============================================================================

-- ============================================================================
-- UNIQUE INDEX: One active config per channel type + name per org
-- Prevents ambiguity when querying active configurations
-- ============================================================================
-- Note: Partial index on `status = 'active'` allows inactive configs
-- with the same name (for historical or backup purposes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcc_org_channel_name_unique
    ON public.messaging_channel_configs(organization_id, channel_type, name)
    WHERE status = 'active';

-- ============================================================================
-- INDEX: Webhook lookup by inbox_id
-- Optimizes the common pattern of resolving organization from inbox_id
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_mcc_org_inbox
    ON public.messaging_channel_configs(organization_id, chatwoot_inbox_id)
    WHERE chatwoot_inbox_id IS NOT NULL;

-- ============================================================================
-- INDEX: Webhook lookup by account_id
-- Optimizes the common pattern of resolving organization from Chatwoot account
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_mcc_account_id_active
    ON public.messaging_channel_configs(chatwoot_account_id)
    WHERE status = 'active';

-- ============================================================================
-- INDEX: Channel type filter for multi-channel queries
-- Optimizes queries that filter by channel type (e.g., find all Instagram configs)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_mcc_org_channel_type
    ON public.messaging_channel_configs(organization_id, channel_type)
    WHERE status = 'active';

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================
COMMENT ON INDEX idx_mcc_org_channel_name_unique IS
    'Ensures only one active config per (org, channel_type, name) combination';

COMMENT ON INDEX idx_mcc_org_inbox IS
    'Optimizes webhook lookups by Chatwoot inbox_id';

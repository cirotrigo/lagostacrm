-- Phase 1 — Contact Identifiers
-- Introduces contact_identifiers to model multi-channel identities for a single
-- contact (WhatsApp phone, Instagram IGSID, Messenger PSID, Telegram ID, email).
--
-- This migration is backward compatible: contacts.phone is preserved as-is.
-- Existing rows are backfilled into contact_identifiers so new code can start
-- looking up contacts by (channel, identifier) without breaking current flows
-- that still read contacts.phone directly.

-- -----------------------------------------------------------------------------
-- 1) Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_identifiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL CHECK (channel IN ('whatsapp','instagram','messenger','telegram','email','sms','other')),
    identifier      TEXT NOT NULL,
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (organization_id, channel, identifier)
);

-- Lookups by identifier alone (most common query from n8n / webhooks)
CREATE INDEX IF NOT EXISTS idx_contact_identifiers_org_identifier
    ON public.contact_identifiers (organization_id, identifier)
    WHERE deleted_at IS NULL;

-- Lookups by contact (list all channels for a contact)
CREATE INDEX IF NOT EXISTS idx_contact_identifiers_contact
    ON public.contact_identifiers (contact_id)
    WHERE deleted_at IS NULL;

-- At most one primary per contact (enforced by partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_identifiers_one_primary
    ON public.contact_identifiers (contact_id)
    WHERE is_primary = true AND deleted_at IS NULL;

ALTER TABLE public.contact_identifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.contact_identifiers FOR ALL TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- 2) updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_identifiers_updated_at ON public.contact_identifiers;
CREATE TRIGGER trg_contact_identifiers_updated_at
    BEFORE UPDATE ON public.contact_identifiers
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3) Backfill existing contacts
--
-- Heuristic:
--   - phone starting with '+' → whatsapp identifier
--   - phone that is all digits and length >= 14 (no country code '55' prefix)
--     → instagram identifier (IGSID)
--   - phone that is all digits starting with '55' and length 12-13 → whatsapp
--   - source='INSTAGRAM' overrides to instagram
--   - source='WHATSAPP' overrides to whatsapp
--   - email present → also create email identifier (skipped if looks synthetic
--     like 'instagram-XXX@chat.local' to avoid polluting)
--
-- Safe to re-run: ON CONFLICT DO NOTHING due to the UNIQUE (org, channel, identifier).
-- -----------------------------------------------------------------------------
INSERT INTO public.contact_identifiers (contact_id, organization_id, channel, identifier, is_primary, created_at)
SELECT
    c.id,
    c.organization_id,
    CASE
        WHEN UPPER(COALESCE(c.source, '')) = 'INSTAGRAM' THEN 'instagram'
        WHEN UPPER(COALESCE(c.source, '')) = 'WHATSAPP'  THEN 'whatsapp'
        WHEN c.phone LIKE '+%' THEN 'whatsapp'
        WHEN c.phone ~ '^[0-9]+$' AND length(c.phone) >= 14 THEN 'instagram'
        WHEN c.phone ~ '^55[0-9]{10,11}$' THEN 'whatsapp'
        ELSE 'other'
    END AS channel,
    c.phone AS identifier,
    true AS is_primary,
    c.created_at
FROM public.contacts c
WHERE c.deleted_at IS NULL
  AND c.phone IS NOT NULL
  AND length(c.phone) > 0
ON CONFLICT (organization_id, channel, identifier) DO NOTHING;

-- Email identifiers (skip synthetic chat.local emails)
INSERT INTO public.contact_identifiers (contact_id, organization_id, channel, identifier, is_primary, created_at)
SELECT
    c.id,
    c.organization_id,
    'email' AS channel,
    c.email AS identifier,
    false AS is_primary,
    c.created_at
FROM public.contacts c
WHERE c.deleted_at IS NULL
  AND c.email IS NOT NULL
  AND length(c.email) > 0
  AND c.email NOT LIKE '%@chat.local'
ON CONFLICT (organization_id, channel, identifier) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4) Helper view for dashboards: contacts with their channel identifiers array
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.contacts_with_identifiers AS
SELECT
    c.*,
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'id', ci.id,
            'channel', ci.channel,
            'identifier', ci.identifier,
            'is_primary', ci.is_primary
        ) ORDER BY ci.is_primary DESC, ci.created_at ASC)
         FROM public.contact_identifiers ci
         WHERE ci.contact_id = c.id AND ci.deleted_at IS NULL),
        '[]'::jsonb
    ) AS identifiers
FROM public.contacts c
WHERE c.deleted_at IS NULL;

COMMENT ON TABLE public.contact_identifiers IS
'Multi-channel identity for contacts. Phase 1: additive alongside contacts.phone. Future phases replace phone-based lookups with identifier-based ones.';

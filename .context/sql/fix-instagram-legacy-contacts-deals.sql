-- Fix legado: contatos/deals marcados como WhatsApp, mas com evidência operacional de Instagram.
-- Escopo: organização específica (substitua :organization_id pelo UUID da org).
--
-- Regra aplicada:
-- 1) O contato tem conversa(s) no inbox Instagram.
-- 2) O contato não tem conversa WhatsApp OU a última conversa Instagram é mais recente que a última WhatsApp.
-- 3) O source atual do contato está como WHATSAPP.
-- 4) Deals ligados a esse contato com título "WhatsApp - ..." são renomeados para "Instagram - ...".
--
-- Segurança:
-- - Idempotente.
-- - Não mexe em contatos sem evidência de Instagram.
-- - Não altera identidade externa (messaging_contact_identities), apenas source do contato e título do deal.

WITH
instagram_inboxes AS (
  SELECT chatwoot_inbox_id
  FROM messaging_channel_configs
  WHERE organization_id = :organization_id
    AND status = 'active'
    AND channel_type = 'instagram'
    AND chatwoot_inbox_id IS NOT NULL
),
whatsapp_inboxes AS (
  SELECT chatwoot_inbox_id
  FROM messaging_channel_configs
  WHERE organization_id = :organization_id
    AND status = 'active'
    AND channel_type = 'whatsapp'
    AND chatwoot_inbox_id IS NOT NULL
),
contact_channel_stats AS (
  SELECT
    mcl.contact_id,
    COUNT(*) FILTER (WHERE mcl.chatwoot_inbox_id IN (SELECT chatwoot_inbox_id FROM instagram_inboxes)) AS instagram_count,
    COUNT(*) FILTER (WHERE mcl.chatwoot_inbox_id IN (SELECT chatwoot_inbox_id FROM whatsapp_inboxes)) AS whatsapp_count,
    MAX(mcl.created_at) FILTER (WHERE mcl.chatwoot_inbox_id IN (SELECT chatwoot_inbox_id FROM instagram_inboxes)) AS last_instagram_at,
    MAX(mcl.created_at) FILTER (WHERE mcl.chatwoot_inbox_id IN (SELECT chatwoot_inbox_id FROM whatsapp_inboxes)) AS last_whatsapp_at
  FROM messaging_conversation_links mcl
  WHERE mcl.organization_id = :organization_id
    AND mcl.contact_id IS NOT NULL
  GROUP BY mcl.contact_id
),
contacts_to_fix AS (
  SELECT c.id
  FROM contacts c
  JOIN contact_channel_stats s ON s.contact_id = c.id
  WHERE c.organization_id = :organization_id
    AND c.deleted_at IS NULL
    AND c.source = 'WHATSAPP'
    AND s.instagram_count > 0
    AND (
      s.whatsapp_count = 0
      OR s.last_instagram_at > s.last_whatsapp_at
    )
),
updated_contacts AS (
  UPDATE contacts c
  SET source = 'INSTAGRAM',
      updated_at = NOW()
  WHERE c.id IN (SELECT id FROM contacts_to_fix)
  RETURNING c.id
),
updated_deals AS (
  UPDATE deals d
  SET title = regexp_replace(d.title, '^WhatsApp - ', 'Instagram - '),
      updated_at = NOW()
  WHERE d.organization_id = :organization_id
    AND d.contact_id IN (SELECT id FROM contacts_to_fix)
    AND d.title ~ '^WhatsApp - '
  RETURNING d.id
)
SELECT
  (SELECT COUNT(*) FROM updated_contacts) AS contacts_updated,
  (SELECT COUNT(*) FROM updated_deals) AS deals_updated;


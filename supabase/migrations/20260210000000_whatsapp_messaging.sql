-- =============================================================================
-- WPPConnect Integration Schema
-- LagostaCRM - Mensageria WhatsApp
-- Migration: 20260210000000_whatsapp_messaging.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sessoes WhatsApp
-- Armazena informacoes das sessoes conectadas ao WPPConnect
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Identificacao da sessao
  session_name TEXT NOT NULL,
  phone_number TEXT,
  profile_name TEXT,
  profile_picture_url TEXT,

  -- Status da conexao
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'qr_pending', 'connected', 'error')),
  qr_code TEXT, -- Base64 do QR Code quando status = 'qr_pending'
  error_message TEXT,

  -- Configuracoes
  is_default BOOLEAN DEFAULT false,
  webhook_url TEXT,
  auto_reconnect BOOLEAN DEFAULT true,

  -- Timestamps
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(organization_id, session_name)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_org ON public.whatsapp_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON public.whatsapp_sessions(status);

-- -----------------------------------------------------------------------------
-- 2. Conversas WhatsApp
-- Cada conversa e vinculada a um contato e opcionalmente a um deal
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,

  -- Vinculos com CRM
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,

  -- Identificacao WhatsApp
  remote_jid TEXT NOT NULL, -- Formato: 5511999999999@c.us ou grupo@g.us
  is_group BOOLEAN DEFAULT false,
  group_name TEXT,

  -- Estado da conversa
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'resolved', 'archived')),
  assigned_to UUID REFERENCES public.profiles(id),
  ai_enabled BOOLEAN DEFAULT true,

  -- Contadores
  unread_count INT DEFAULT 0,
  total_messages INT DEFAULT 0,

  -- Timestamps
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(session_id, remote_jid)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_org ON public.whatsapp_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_contact ON public.whatsapp_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_deal ON public.whatsapp_conversations(deal_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_msg ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_inbox ON public.whatsapp_conversations(organization_id, last_message_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Mensagens WhatsApp
-- Historico completo de mensagens de cada conversa
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,

  -- Identificacao WhatsApp
  wpp_message_id TEXT,

  -- Direcao e tipo
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  media_type TEXT DEFAULT 'text'
    CHECK (media_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'poll')),

  -- Conteudo
  content TEXT,
  caption TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  media_size_bytes BIGINT,

  -- Localizacao (se media_type = 'location')
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_name TEXT,

  -- Status de entrega (apenas outbound)
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  status_updated_at TIMESTAMPTZ,
  error_message TEXT,

  -- Metadados do remetente
  sender_jid TEXT,
  sender_name TEXT,
  sender_phone TEXT,

  -- Mensagem citada (reply)
  quoted_message_id UUID REFERENCES public.whatsapp_messages(id),

  -- Metadados
  is_from_me BOOLEAN DEFAULT false,
  is_forwarded BOOLEAN DEFAULT false,
  is_broadcast BOOLEAN DEFAULT false,

  -- Timestamps
  wpp_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(conversation_id, wpp_message_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON public.whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wpp_id ON public.whatsapp_messages(wpp_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_pagination ON public.whatsapp_messages(conversation_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Sincronizacao de Labels (Etiquetas)
-- Mapeamento entre labels do WhatsApp e tags do CRM
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_label_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,

  -- Label do WhatsApp
  wpp_label_id TEXT NOT NULL,
  wpp_label_name TEXT NOT NULL,
  wpp_label_color TEXT,

  -- Tag do CRM (pode ser NULL se ainda nao mapeada)
  crm_tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,

  -- Configuracao de sincronizacao
  sync_direction TEXT DEFAULT 'both'
    CHECK (sync_direction IN ('to_crm', 'to_wpp', 'both', 'none')),
  auto_create_tag BOOLEAN DEFAULT true,

  -- Timestamps
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(session_id, wpp_label_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_label_sync_org ON public.whatsapp_label_sync(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_label_sync_tag ON public.whatsapp_label_sync(crm_tag_id);

-- -----------------------------------------------------------------------------
-- 5. Labels aplicadas em conversas
-- Registro de quais labels estao aplicadas em cada conversa
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  label_sync_id UUID NOT NULL REFERENCES public.whatsapp_label_sync(id) ON DELETE CASCADE,

  -- Timestamps
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by TEXT CHECK (applied_by IN ('wpp', 'crm', 'n8n')),

  -- Constraints
  UNIQUE(conversation_id, label_sync_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_labels_conversation ON public.whatsapp_conversation_labels(conversation_id);

-- -----------------------------------------------------------------------------
-- 6. Webhook Events (Log de eventos recebidos)
-- Para debug e auditoria
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.whatsapp_sessions(id) ON DELETE SET NULL,

  -- Evento
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Processamento
  status TEXT DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,

  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_org ON public.whatsapp_webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_type ON public.whatsapp_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_status ON public.whatsapp_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_received ON public.whatsapp_webhook_events(received_at DESC);

-- -----------------------------------------------------------------------------
-- 7. Templates de Mensagem
-- Templates reutilizaveis para mensagens frequentes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Identificacao
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'greeting', 'follow_up', 'closing')),

  -- Conteudo
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,

  -- Metadados
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),

  -- Constraints
  UNIQUE(organization_id, name)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org ON public.whatsapp_message_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON public.whatsapp_message_templates(category);

-- -----------------------------------------------------------------------------
-- 8. Triggers para atualizacao automatica
-- -----------------------------------------------------------------------------

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_whatsapp_sessions_updated
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER trg_whatsapp_conversations_updated
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER trg_whatsapp_label_sync_updated
  BEFORE UPDATE ON public.whatsapp_label_sync
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER trg_whatsapp_templates_updated
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

-- Trigger para atualizar contadores da conversa
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.whatsapp_conversations
  SET
    total_messages = total_messages + 1,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    last_message_direction = NEW.direction,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_inserted
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- -----------------------------------------------------------------------------
-- 9. Row Level Security (RLS)
-- -----------------------------------------------------------------------------

-- Habilitar RLS
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_label_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;

-- Policies para whatsapp_sessions
CREATE POLICY "Users can view own org sessions"
  ON public.whatsapp_sessions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own org sessions"
  ON public.whatsapp_sessions FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own org sessions"
  ON public.whatsapp_sessions FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Policies para whatsapp_conversations
CREATE POLICY "Users can view own org conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own org conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own org conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Policies para whatsapp_messages
CREATE POLICY "Users can view own org messages"
  ON public.whatsapp_messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM public.whatsapp_conversations WHERE organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert own org messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (conversation_id IN (
    SELECT id FROM public.whatsapp_conversations WHERE organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

-- Policies para whatsapp_label_sync
CREATE POLICY "Users can view own org label sync"
  ON public.whatsapp_label_sync FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage own org label sync"
  ON public.whatsapp_label_sync FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Policies para whatsapp_conversation_labels
CREATE POLICY "Users can view own org conversation labels"
  ON public.whatsapp_conversation_labels FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM public.whatsapp_conversations WHERE organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage own org conversation labels"
  ON public.whatsapp_conversation_labels FOR ALL
  USING (conversation_id IN (
    SELECT id FROM public.whatsapp_conversations WHERE organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

-- Policies para whatsapp_webhook_events
CREATE POLICY "Users can view own org webhook events"
  ON public.whatsapp_webhook_events FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Policies para whatsapp_message_templates
CREATE POLICY "Users can view own org templates"
  ON public.whatsapp_message_templates FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage own org templates"
  ON public.whatsapp_message_templates FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- 10. Views uteis
-- -----------------------------------------------------------------------------

-- View de conversas com informacoes do contato
CREATE OR REPLACE VIEW public.v_whatsapp_conversations AS
SELECT
  wc.*,
  c.name AS contact_name,
  c.phone AS contact_phone,
  c.email AS contact_email,
  c.avatar AS contact_avatar,
  d.title AS deal_title,
  d.value AS deal_value,
  bs.name AS deal_stage,
  ws.session_name,
  ws.phone_number AS session_phone
FROM public.whatsapp_conversations wc
LEFT JOIN public.contacts c ON wc.contact_id = c.id
LEFT JOIN public.deals d ON wc.deal_id = d.id
LEFT JOIN public.board_stages bs ON d.stage_id = bs.id
LEFT JOIN public.whatsapp_sessions ws ON wc.session_id = ws.id;

-- View de labels com mapeamento
CREATE OR REPLACE VIEW public.v_whatsapp_labels AS
SELECT
  wls.*,
  t.name AS crm_tag_name,
  t.color AS crm_tag_color
FROM public.whatsapp_label_sync wls
LEFT JOIN public.tags t ON wls.crm_tag_id = t.id;

-- -----------------------------------------------------------------------------
-- 11. Realtime - Habilitar publicacao
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- -----------------------------------------------------------------------------
-- 12. Storage Bucket para midia
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para storage
CREATE POLICY "Public can view whatsapp media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated can upload whatsapp media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated can delete own whatsapp media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

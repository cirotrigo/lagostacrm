import { createAdminClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const WPPCONNECT_SECRET_KEY = process.env.WPPCONNECT_SECRET_KEY;

/**
 * POST /api/whatsapp/webhook
 * Recebe eventos do n8n (que processa webhooks do WPPConnect)
 *
 * Eventos suportados:
 * - message.received: Nova mensagem recebida
 * - message.ack: Status de entrega atualizado
 * - session.status: Status da sessão mudou
 */
export async function POST(req: Request) {
  // Valida secret key do header
  const authHeader = req.headers.get('Authorization');
  const providedKey = authHeader?.replace('Bearer ', '');

  if (!WPPCONNECT_SECRET_KEY || providedKey !== WPPCONNECT_SECRET_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = await createAdminClient();

  const body = await req.json().catch(() => null);

  if (!body || !body.event) {
    return json({ error: 'Invalid payload' }, 400);
  }

  const { event, data, session_name, organization_id } = body;

  // Log evento para debug
  await supabase.from('whatsapp_webhook_events').insert({
    organization_id: organization_id || null,
    event_type: event,
    payload: body,
    status: 'received',
  });

  try {
    switch (event) {
      case 'message.received':
        await handleMessageReceived(supabase, data, session_name, organization_id);
        break;

      case 'message.ack':
        await handleMessageAck(supabase, data);
        break;

      case 'session.status':
        await handleSessionStatus(supabase, data, session_name, organization_id);
        break;

      default:
        // Evento desconhecido, apenas loga
        break;
    }

    // Atualiza status do evento
    await supabase
      .from('whatsapp_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('payload->>event', event)
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .limit(1);

    return json({ ok: true, event });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[whatsapp/webhook] Error:', errorMessage);

    await supabase
      .from('whatsapp_webhook_events')
      .update({
        status: 'failed',
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq('payload->>event', event)
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .limit(1);

    return json({ error: errorMessage }, 500);
  }
}

async function handleMessageReceived(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  data: {
    wpp_message_id: string;
    conversation_id?: string; // Agora opcional - pode usar phone para buscar/criar
    phone?: string; // Telefone do contato (alternativa ao conversation_id)
    content: string;
    media_type?: string;
    media_url?: string;
    sender_jid: string;
    sender_name?: string;
    sender_phone?: string;
    wpp_timestamp?: string;
    is_forwarded?: boolean;
    quoted_wpp_id?: string;
    is_from_me?: boolean;
  },
  sessionName: string,
  organizationId: string
) {
  const {
    wpp_message_id,
    content,
    media_type = 'text',
    media_url,
    sender_jid,
    sender_name,
    sender_phone,
    wpp_timestamp,
    is_forwarded = false,
    quoted_wpp_id,
    is_from_me = false,
  } = data;

  // Determina o telefone do contato
  const contactPhone = data.phone || sender_phone || sender_jid?.replace('@c.us', '').replace('@s.whatsapp.net', '');

  if (!contactPhone) {
    throw new Error('Phone number is required');
  }

  // Busca ou cria a conversa
  let conversationId = data.conversation_id;

  if (!conversationId) {
    // Busca sessão pelo nome para pegar organization_id e session_id
    let orgId = organizationId;
    let sessionId: string | null = null;

    if (sessionName) {
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('id, organization_id')
        .eq('session_name', sessionName)
        .single();

      if (session) {
        sessionId = session.id;
        if (!orgId) orgId = session.organization_id;
      }
    }

    if (!orgId) {
      throw new Error('Organization ID not found');
    }

    if (!sessionId) {
      // Busca a sessão padrão da organização
      const { data: defaultSession } = await supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_default', true)
        .single();

      if (defaultSession) {
        sessionId = defaultSession.id;
      } else {
        // Pega qualquer sessão da organização
        const { data: anySession } = await supabase
          .from('whatsapp_sessions')
          .select('id')
          .eq('organization_id', orgId)
          .limit(1)
          .single();

        sessionId = anySession?.id || null;
      }
    }

    if (!sessionId) {
      throw new Error('No WhatsApp session found for organization');
    }

    const remoteJid = sender_jid || `${contactPhone}@c.us`;

    // Busca conversa existente pelo remote_jid
    const { data: existingConversation } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('session_id', sessionId)
      .eq('remote_jid', remoteJid)
      .single();

    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      // Busca ou cria contato no CRM
      let contactId: string | null = null;

      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', contactPhone)
        .single();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        // Cria novo contato
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            organization_id: orgId,
            name: sender_name || contactPhone,
            phone: contactPhone,
            source: 'WHATSAPP',
            stage: 'LEAD',
            status: 'ACTIVE',
          })
          .select('id')
          .single();

        contactId = newContact?.id || null;
      }

      // Cria nova conversa
      const { data: newConversation, error: createError } = await supabase
        .from('whatsapp_conversations')
        .insert({
          organization_id: orgId,
          session_id: sessionId,
          remote_jid: remoteJid,
          contact_id: contactId,
          status: 'open',
          ai_enabled: true,
        })
        .select('id')
        .single();

      if (createError || !newConversation) {
        throw new Error(`Failed to create conversation: ${createError?.message}`);
      }

      conversationId = newConversation.id;
    }
  }

  // Busca quoted_message_id se houver
  let quoted_message_id = null;
  if (quoted_wpp_id) {
    const { data: quotedMsg } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('wpp_message_id', quoted_wpp_id)
      .single();
    quoted_message_id = quotedMsg?.id || null;
  }

  // Insere mensagem (trigger atualiza contadores da conversa)
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    wpp_message_id,
    direction: is_from_me ? 'outbound' : 'inbound',
    media_type,
    content,
    media_url: media_url || null,
    sender_jid,
    sender_name: sender_name || null,
    sender_phone: sender_phone || contactPhone,
    wpp_timestamp: wpp_timestamp || new Date().toISOString(),
    is_forwarded,
    quoted_message_id,
    status: is_from_me ? 'sent' : 'delivered',
    is_from_me,
  });
}

async function handleMessageAck(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  data: {
    wpp_message_id: string;
    ack: number; // 1=sent, 2=delivered, 3=read
  }
) {
  const { wpp_message_id, ack } = data;

  const statusMap: Record<number, string> = {
    1: 'sent',
    2: 'delivered',
    3: 'read',
  };

  const status = statusMap[ack] || 'sent';

  await supabase
    .from('whatsapp_messages')
    .update({
      status,
      status_updated_at: new Date().toISOString(),
    })
    .eq('wpp_message_id', wpp_message_id);
}

async function handleSessionStatus(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  data: {
    status: string;
    phone_number?: string;
    profile_name?: string;
    profile_picture_url?: string;
    error_message?: string;
  },
  sessionName: string,
  organizationId: string
) {
  const { status, phone_number, profile_name, profile_picture_url, error_message } = data;

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (phone_number) updates.phone_number = phone_number;
  if (profile_name) updates.profile_name = profile_name;
  if (profile_picture_url) updates.profile_picture_url = profile_picture_url;
  if (error_message) updates.error_message = error_message;

  if (status === 'connected') {
    updates.connected_at = new Date().toISOString();
    updates.qr_code = null;
    updates.error_message = null;
  }

  await supabase
    .from('whatsapp_sessions')
    .update(updates)
    .eq('session_name', sessionName)
    .eq('organization_id', organizationId);
}

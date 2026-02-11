import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const WPPCONNECT_HOST = process.env.WPPCONNECT_HOST;
const WPPCONNECT_SECRET_KEY = process.env.WPPCONNECT_SECRET_KEY;
const WPPCONNECT_SESSION_NAME = process.env.WPPCONNECT_SESSION_NAME || 'lagostacrm-main';

const SendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(4096),
  media_url: z.string().url().optional(),
  media_type: z.enum(['image', 'audio', 'video', 'document']).optional(),
  quoted_message_id: z.string().uuid().optional(),
});

/**
 * POST /api/whatsapp/send
 * Envia mensagem via WPPConnect e persiste no Supabase
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return json({ error: 'Forbidden' }, 403);
  }

  if (!WPPCONNECT_HOST || !WPPCONNECT_SECRET_KEY) {
    return json({ error: 'WPPConnect not configured' }, 503);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return json({ error: 'Profile not found' }, 404);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = SendMessageSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const { conversation_id, content, media_url, media_type, quoted_message_id } = parsed.data;

  // Busca conversa para obter remote_jid
  const { data: conversation, error: convError } = await supabase
    .from('whatsapp_conversations')
    .select('id, remote_jid, organization_id')
    .eq('id', conversation_id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (convError || !conversation) {
    return json({ error: 'Conversation not found' }, 404);
  }

  // Formata número para WPPConnect
  const phone = conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');

  try {
    let wppEndpoint = `${WPPCONNECT_HOST}/api/${WPPCONNECT_SESSION_NAME}/send-message`;
    let wppBody: Record<string, unknown> = {
      phone,
      message: content,
    };

    // Se tem mídia, usa endpoint específico
    if (media_url && media_type) {
      const mediaEndpoints: Record<string, string> = {
        image: 'send-image',
        audio: 'send-audio',
        video: 'send-video-as-gif',
        document: 'send-file',
      };
      wppEndpoint = `${WPPCONNECT_HOST}/api/${WPPCONNECT_SESSION_NAME}/${mediaEndpoints[media_type]}`;
      wppBody = {
        phone,
        path: media_url,
        caption: content,
      };
    }

    // Envia para WPPConnect
    const wppResponse = await fetch(wppEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WPPCONNECT_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wppBody),
    });

    const wppResult = await wppResponse.json().catch(() => ({}));

    if (!wppResponse.ok) {
      return json(
        { error: 'Failed to send message', details: wppResult },
        wppResponse.status
      );
    }

    // Persiste mensagem no Supabase
    const { data: message, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id,
        wpp_message_id: wppResult.id || null,
        direction: 'outbound',
        media_type: media_type || 'text',
        content,
        media_url: media_url || null,
        status: 'sent',
        is_from_me: true,
        quoted_message_id: quoted_message_id || null,
        sender_phone: phone,
        wpp_timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[whatsapp/send] Failed to persist message:', insertError);
      // Não falha a requisição, mensagem foi enviada
    }

    return json({
      ok: true,
      message: message || null,
      wppResult,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: errorMessage }, 500);
  }
}

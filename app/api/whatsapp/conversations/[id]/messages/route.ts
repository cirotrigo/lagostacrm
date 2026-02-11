import { createClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/whatsapp/conversations/[id]/messages
 * Lista mensagens de uma conversa com paginação cursor-based
 */
export async function GET(req: Request, ctx: RouteContext) {
  const { id: conversationId } = await ctx.params;

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

  // Verifica se conversa pertence à organização
  const { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('id, organization_id')
    .eq('id', conversationId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!conversation) {
    return json({ error: 'Conversation not found' }, 404);
  }

  // Parse query params
  const url = new URL(req.url);
  const beforeId = url.searchParams.get('before_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const markAsRead = url.searchParams.get('mark_as_read') === 'true';

  // Build query
  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // +1 para verificar se há mais

  // Cursor-based pagination
  if (beforeId) {
    const { data: cursorMsg } = await supabase
      .from('whatsapp_messages')
      .select('created_at')
      .eq('id', beforeId)
      .single();

    if (cursorMsg) {
      query = query.lt('created_at', cursorMsg.created_at);
    }
  }

  const { data: messages, error } = await query;

  if (error) {
    return json({ error: error.message }, 500);
  }

  // Verifica se há mais mensagens
  const hasMore = messages && messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages || [];

  // Marca como lidas se solicitado
  if (markAsRead && resultMessages.length > 0) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
  }

  return json({
    data: resultMessages.reverse(), // Retorna em ordem cronológica
    has_more: hasMore,
    oldest_id: resultMessages.length > 0 ? resultMessages[0].id : null,
  });
}

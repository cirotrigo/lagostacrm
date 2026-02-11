import { createClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * GET /api/whatsapp/conversations
 * Lista conversas WhatsApp da organização
 */
export async function GET(req: Request) {
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

  // Parse query params
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'all';
  const assignedTo = url.searchParams.get('assigned_to') || 'all';
  const search = url.searchParams.get('search') || '';
  const hasUnread = url.searchParams.get('has_unread') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Build query usando a view
  let query = supabase
    .from('v_whatsapp_conversations')
    .select('*', { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  // Filtros
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (assignedTo === 'unassigned') {
    query = query.is('assigned_to', null);
  } else if (assignedTo !== 'all') {
    query = query.eq('assigned_to', assignedTo);
  }

  if (hasUnread) {
    query = query.gt('unread_count', 0);
  }

  if (search) {
    query = query.or(
      `contact_name.ilike.%${search}%,contact_phone.ilike.%${search}%,last_message_preview.ilike.%${search}%`
    );
  }

  const { data: conversations, error, count } = await query;

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({
    data: conversations || [],
    total: count || 0,
    limit,
    offset,
  });
}

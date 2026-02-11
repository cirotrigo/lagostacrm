import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/whatsapp/conversations/[id]
 * Retorna detalhes de uma conversa específica
 */
export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

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

  const { data: conversation, error } = await supabase
    .from('v_whatsapp_conversations')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return json({ error: 'Conversation not found' }, 404);
    }
    return json({ error: error.message }, 500);
  }

  return json({ data: conversation });
}

const UpdateConversationSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'archived']).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  ai_enabled: z.boolean().optional(),
});

/**
 * PATCH /api/whatsapp/conversations/[id]
 * Atualiza uma conversa (status, assigned_to, ai_enabled)
 */
export async function PATCH(req: Request, ctx: RouteContext) {
  if (!isAllowedOrigin(req)) {
    return json({ error: 'Forbidden' }, 403);
  }

  const { id } = await ctx.params;

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
  const parsed = UpdateConversationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const updates = parsed.data;

  // Verifica se conversa pertence à organização
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!existing) {
    return json({ error: 'Conversation not found' }, 404);
  }

  const { data: conversation, error } = await supabase
    .from('whatsapp_conversations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ data: conversation });
}

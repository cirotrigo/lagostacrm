import { z } from 'zod';
import { randomBytes } from 'crypto';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { loadInstance } from '@/lib/integrations/evolution-api';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const BodySchema = z.object({
  ttlMinutes: z.number().int().min(5).max(60 * 24).optional(),
}).strict();

/**
 * POST /api/integrations/evolution/share
 * Gera um token temporário (default: 60min) que permite a um terceiro
 * (cliente final) acessar /connect-whatsapp/[token] e escanear o QR Code
 * sem precisar fazer login no CRM.
 *
 * Retorna a URL completa para o admin compartilhar.
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (profile.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const rawBody = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(rawBody ?? {});
  if (!parsed.success) return json({ error: 'Invalid payload' }, 400);
  const ttlMinutes = parsed.data.ttlMinutes ?? 60;

  const instance = await loadInstance(profile.organization_id);
  if (!instance) return json({ error: 'No Evolution instance configured for this organization' }, 404);

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  const sb = createStaticAdminClient();
  const { error } = await sb.from('evolution_connect_tokens').insert({
    instance_id: instance.id,
    token,
    created_by: user.id,
    expires_at: expiresAt,
  });
  if (error) return json({ error: error.message }, 500);

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
  const url = `${origin}/connect-whatsapp/${token}`;
  return json({ ok: true, token, url, expiresAt, ttlMinutes });
}

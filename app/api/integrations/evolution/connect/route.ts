import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { connect, loadInstance } from '@/lib/integrations/evolution-api';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** POST /api/integrations/evolution/connect — gera QR Code (chama /instance/connect). */
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

  const instance = await loadInstance(profile.organization_id);
  if (!instance) return json({ error: 'No Evolution instance configured for this organization' }, 404);

  try {
    const qr = await connect(instance);
    return json({ ok: true, ...qr });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'connect failed' }, 502);
  }
}

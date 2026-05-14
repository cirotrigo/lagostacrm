import { z } from 'zod';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { getStatus, loadInstance, type EvolutionStatus } from '@/lib/integrations/evolution-api';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function authedAdmin(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Unauthorized' }, 401) } as const;
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return { error: json({ error: 'Profile not found' }, 404) } as const;
  if (profile.role !== 'admin') return { error: json({ error: 'Forbidden' }, 403) } as const;
  return { user, organizationId: profile.organization_id as string } as const;
}

/**
 * GET /api/integrations/evolution
 * Retorna instância configurada + status atual (refresh from Evolution).
 * NUNCA expõe a api_key.
 */
export async function GET(req: Request) {
  const auth = await authedAdmin(req);
  if ('error' in auth) return auth.error;

  const instance = await loadInstance(auth.organizationId);
  if (!instance) {
    return json({ configured: false, instance: null });
  }

  let status: EvolutionStatus = instance.last_status;
  let liveError: string | null = null;
  try {
    const live = await getStatus(instance);
    status = live.state;
  } catch (e) {
    liveError = e instanceof Error ? e.message : 'failed to reach Evolution';
  }

  return json({
    configured: true,
    instance: {
      id: instance.id,
      instance_name: instance.instance_name,
      base_url: instance.base_url,
      phone_number: instance.phone_number,
      profile_name: instance.profile_name,
      profile_picture_url: instance.profile_picture_url,
      last_status: status,
      last_synced_at: instance.last_synced_at,
    },
    liveError,
  });
}

const UpsertSchema = z.object({
  instance_name: z.string().min(1).max(120),
  base_url: z.string().url(),
  api_key: z.string().min(1).max(500),
}).strict();

/**
 * POST /api/integrations/evolution
 * Cria ou atualiza a instância Evolution da organização (UPSERT por organization_id).
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const auth = await authedAdmin(req);
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);

  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('evolution_instances')
    .upsert(
      {
        organization_id: auth.organizationId,
        instance_name: parsed.data.instance_name,
        base_url: parsed.data.base_url,
        api_key: parsed.data.api_key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' },
    )
    .select('id, instance_name, base_url, phone_number, profile_name, last_status')
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, instance: data });
}

/**
 * DELETE /api/integrations/evolution
 * Remove a configuração da organização (não desconecta no Evolution).
 */
export async function DELETE(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const auth = await authedAdmin(req);
  if ('error' in auth) return auth.error;

  const sb = createStaticAdminClient();
  const { error } = await sb
    .from('evolution_instances')
    .delete()
    .eq('organization_id', auth.organizationId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

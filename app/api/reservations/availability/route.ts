import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkAvailability } from '@/lib/public-api/availability';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const Schema = z.object({
  start: z.string().min(1),
  party_size: z.number().int().positive(),
  duration_minutes: z.number().int().positive().optional(),
  area_id: z.string().min(1).optional(),
}).strict();

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);

  const start = new Date(parsed.data.start);
  if (Number.isNaN(start.getTime())) return json({ error: 'Invalid start date' }, 400);

  try {
    const result = await checkAvailability({
      organizationId: profile.organization_id,
      start,
      partySize: parsed.data.party_size,
      durationMinutes: parsed.data.duration_minutes,
      areaId: parsed.data.area_id,
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
}

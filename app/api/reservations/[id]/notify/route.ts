import { z } from 'zod';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  DEFAULT_APPROVE_TEMPLATE,
  DEFAULT_REJECT_TEMPLATE,
  notifyReservationCustomer,
  renderTemplate,
} from '@/lib/integrations/chatwoot-notify';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({
  template: z.enum(['approve', 'reject']),
  reason: z.string().min(1).max(500).optional(),
}).strict();

/**
 * Envia notificação ao cliente para uma reserva existente, sem alterar status.
 * Usado quando uma reserva é criada manualmente pela UI (já em status=confirmed)
 * e queremos avisar o cliente.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const resolved = await params;
  const parsed = ParamsSchema.safeParse(resolved);
  if (!parsed.success) return json({ error: 'Invalid id' }, 400);

  const rawBody = await req.json().catch(() => null);
  const body = BodySchema.safeParse(rawBody);
  if (!body.success) return json({ error: 'Invalid payload', details: body.error.flatten() }, 400);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const sb = createStaticAdminClient();
  const { data: activity, error: fetchErr } = await sb
    .from('activities')
    .select('id, title, date, contact_id, metadata, organization_id, type')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!activity) return json({ error: 'Reservation not found' }, 404);
  if ((activity as any).organization_id !== profile.organization_id) {
    return json({ error: 'Forbidden' }, 403);
  }
  if ((activity as any).type !== 'meeting') {
    return json({ error: 'Activity is not a reservation' }, 400);
  }

  const metadata = ((activity as any).metadata ?? {}) as Record<string, unknown>;

  const { data: contact } = await sb
    .from('contacts')
    .select('name, phone')
    .eq('id', (activity as any).contact_id)
    .maybeSingle();
  const { data: settings } = await sb
    .from('organization_settings')
    .select('scheduling_approve_template, scheduling_reject_template')
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  const isApprove = body.data.template === 'approve';
  const template =
    isApprove
      ? ((settings as any)?.scheduling_approve_template as string | null | undefined) || DEFAULT_APPROVE_TEMPLATE
      : ((settings as any)?.scheduling_reject_template as string | null | undefined) || DEFAULT_REJECT_TEMPLATE;

  const startDate = new Date((activity as any).date);
  const dateStr = startDate.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = startDate.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
  const message = renderTemplate(template, {
    nome: (contact as any)?.name?.split(' ')?.[0] || (contact as any)?.name || 'cliente',
    data: dateStr,
    hora: timeStr,
    pessoas: Number(metadata.party_size ?? 0) || '',
    motivo: body.data.reason ?? '',
  });

  const conversationId = Number(metadata.chatwoot_conversation_id) || null;
  const channel = (metadata.channel === 'INSTAGRAM' ? 'instagram' : 'whatsapp') as 'whatsapp' | 'instagram';

  const notify = await notifyReservationCustomer({
    organizationId: profile.organization_id,
    message,
    conversationId,
    preferredChannel: channel,
    contactPhone: (contact as any)?.phone ?? null,
  });

  return json({ ok: true, notification: notify });
}

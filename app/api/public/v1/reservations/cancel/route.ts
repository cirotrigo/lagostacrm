import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { sanitizeUUID } from '@/lib/supabase/utils';
import { moveStageByIdentity } from '@/lib/public-api/dealsMoveStage';

export const runtime = 'nodejs';

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const Schema = z.object({
  activity_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  contact_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  reason: z.preprocess(emptyToUndefined, z.string().optional()),
  board_key_or_id: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  cancel_stage_label: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ai_summary: z.preprocess(emptyToUndefined, z.string().optional()),
}).strict()
  .refine((v) => !!(v.activity_id || v.contact_id), {
    message: 'activity_id or contact_id is required',
  });

export async function POST(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();
  const reason = parsed.data.reason ?? 'Cancelado pelo cliente';

  // Encontrar activity: por id, ou a meeting confirmada mais recente do contact_id
  let activityId = sanitizeUUID(parsed.data.activity_id ?? null);
  if (!activityId && parsed.data.contact_id) {
    const { data, error } = await sb
      .from('activities')
      .select('id, metadata')
      .eq('organization_id', auth.organizationId)
      .eq('contact_id', sanitizeUUID(parsed.data.contact_id))
      .eq('type', 'meeting')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
    const confirmed = (data ?? []).find((row: any) => {
      const status = row?.metadata?.status;
      return !status || status === 'confirmed';
    });
    activityId = confirmed?.id ?? null;
  }

  if (!activityId) {
    return NextResponse.json({ error: 'No active reservation found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Atualizar activity: status canceled
  const { data: existing, error: fetchErr } = await sb
    .from('activities')
    .select('id, metadata, contact_id')
    .eq('organization_id', auth.organizationId)
    .eq('id', activityId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message, code: 'DB_ERROR' }, { status: 500 });
  if (!existing) {
    return NextResponse.json({ error: 'Activity not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const nextMetadata = {
    ...((existing as any).metadata || {}),
    status: 'canceled',
    canceled_at: new Date().toISOString(),
    cancel_reason: reason,
  };

  const { error: updateErr } = await sb
    .from('activities')
    .update({ metadata: nextMetadata, completed: true })
    .eq('organization_id', auth.organizationId)
    .eq('id', activityId);
  if (updateErr) return NextResponse.json({ error: updateErr.message, code: 'DB_ERROR' }, { status: 500 });

  // Mover deal pra stage de cancelamento, se solicitado
  let moveResult: any = null;
  if (parsed.data.board_key_or_id && parsed.data.cancel_stage_label) {
    const moveRes = await moveStageByIdentity({
      organizationId: auth.organizationId,
      boardKeyOrId: parsed.data.board_key_or_id,
      contactId: sanitizeUUID(parsed.data.contact_id ?? (existing as any).contact_id),
      phone: null,
      email: null,
      channel: null,
      identifier: null,
      target: { to_stage_id: null, to_stage_label: parsed.data.cancel_stage_label },
      mark: 'lost',
      aiSummary: parsed.data.ai_summary ?? `Reserva cancelada: ${reason}`,
    });
    moveResult = moveRes.body;
  }

  return NextResponse.json({
    data: { activity_id: activityId, status: 'canceled', reason },
    deal_move: moveResult,
    action: 'canceled',
  });
}

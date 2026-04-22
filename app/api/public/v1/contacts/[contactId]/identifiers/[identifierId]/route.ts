import { NextResponse } from 'next/server';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/supabase/utils';

export const runtime = 'nodejs';

/**
 * DELETE /api/public/v1/contacts/{contactId}/identifiers/{identifierId}
 * Soft-deletes a channel identifier (keeps row for auditability).
 */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ contactId: string; identifierId: string }> }
) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { contactId, identifierId } = await ctx.params;
  if (!isValidUUID(contactId) || !isValidUUID(identifierId)) {
    return NextResponse.json({ error: 'Invalid id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('contact_identifiers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('organization_id', auth.organizationId)
    .eq('contact_id', contactId)
    .eq('id', identifierId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Identifier not found', code: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true, id: data.id });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/supabase/utils';

export const runtime = 'nodejs';

const VALID_CHANNELS = ['whatsapp','instagram','messenger','telegram','email','sms','other'] as const;

const IdentifierUpsertSchema = z.object({
  channel: z.enum(VALID_CHANNELS),
  identifier: z.string().min(1).max(256),
  is_primary: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

/**
 * GET /api/public/v1/contacts/{contactId}/identifiers
 * Lists all channel identifiers for a contact.
 */
export async function GET(request: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { contactId } = await ctx.params;
  if (!isValidUUID(contactId)) {
    return NextResponse.json({ error: 'Invalid contact id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();

  // Verify contact belongs to org (cheap existence check)
  const { data: contact, error: contactErr } = await sb
    .from('contacts')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .eq('id', contactId)
    .maybeSingle();
  if (contactErr) return NextResponse.json({ error: contactErr.message, code: 'DB_ERROR' }, { status: 500 });
  if (!contact) return NextResponse.json({ error: 'Contact not found', code: 'NOT_FOUND' }, { status: 404 });

  const { data, error } = await sb
    .from('contact_identifiers')
    .select('id,channel,identifier,is_primary,metadata,created_at,updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('contact_id', contactId)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

/**
 * POST /api/public/v1/contacts/{contactId}/identifiers
 *
 * Adds a new channel identifier to the contact. Upserts on
 * (organization_id, channel, identifier) so re-sends are idempotent.
 *
 * If `is_primary: true` is passed, any previously-primary identifier for the
 * same contact is demoted atomically.
 */
export async function POST(request: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { contactId } = await ctx.params;
  if (!isValidUUID(contactId)) {
    return NextResponse.json({ error: 'Invalid contact id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const body = await request.json().catch(() => null);
  const parsed = IdentifierUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();

  const { data: contact, error: contactErr } = await sb
    .from('contacts')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .eq('id', contactId)
    .maybeSingle();
  if (contactErr) return NextResponse.json({ error: contactErr.message, code: 'DB_ERROR' }, { status: 500 });
  if (!contact) return NextResponse.json({ error: 'Contact not found', code: 'NOT_FOUND' }, { status: 404 });

  // If another contact in the same org already owns this (channel, identifier),
  // return a conflict so the caller can decide whether to merge.
  const { data: conflict, error: conflictErr } = await sb
    .from('contact_identifiers')
    .select('id, contact_id')
    .eq('organization_id', auth.organizationId)
    .eq('channel', parsed.data.channel)
    .eq('identifier', parsed.data.identifier)
    .is('deleted_at', null)
    .maybeSingle();
  if (conflictErr) return NextResponse.json({ error: conflictErr.message, code: 'DB_ERROR' }, { status: 500 });
  if (conflict && conflict.contact_id !== contactId) {
    return NextResponse.json({
      error: 'Identifier already attached to another contact',
      code: 'IDENTIFIER_CONFLICT',
      existing_contact_id: conflict.contact_id,
    }, { status: 409 });
  }

  if (parsed.data.is_primary === true) {
    // Demote any previous primary on this contact.
    const { error: demoteErr } = await sb
      .from('contact_identifiers')
      .update({ is_primary: false })
      .eq('organization_id', auth.organizationId)
      .eq('contact_id', contactId)
      .eq('is_primary', true);
    if (demoteErr) return NextResponse.json({ error: demoteErr.message, code: 'DB_ERROR' }, { status: 500 });
  }

  const payload = {
    organization_id: auth.organizationId,
    contact_id: contactId,
    channel: parsed.data.channel,
    identifier: parsed.data.identifier,
    is_primary: parsed.data.is_primary === true,
    metadata: parsed.data.metadata ?? {},
  };

  const { data, error } = await sb
    .from('contact_identifiers')
    .upsert(payload, { onConflict: 'organization_id,channel,identifier' })
    .select('id,channel,identifier,is_primary,metadata,created_at,updated_at')
    .single();
  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

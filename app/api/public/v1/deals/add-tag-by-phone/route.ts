import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { normalizeText } from '@/lib/public-api/sanitize';

export const runtime = 'nodejs';

const AddTagByPhoneSchema = z.object({
  phone: z.string().min(1),
  board_key_or_id: z.string().min(1),
  tag: z.string().min(1).max(100),
}).strict();

/**
 * POST /api/public/v1/deals/add-tag-by-phone
 * Adiciona uma tag ao deal aberto do contato identificado pelo telefone
 */
export async function POST(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = AddTagByPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid payload. Required: { phone, board_key_or_id, tag }',
      code: 'VALIDATION_ERROR'
    }, { status: 422 });
  }

  const { phone, board_key_or_id, tag } = parsed.data;
  const tagToAdd = normalizeText(tag)?.toLowerCase() || tag.toLowerCase();

  const sb = createStaticAdminClient();

  // 1. Buscar o board
  const { data: board, error: boardError } = await sb
    .from('boards')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .or(`id.eq.${board_key_or_id},board_key.eq.${board_key_or_id}`)
    .maybeSingle();

  if (boardError) return NextResponse.json({ error: boardError.message, code: 'DB_ERROR' }, { status: 500 });
  if (!board) return NextResponse.json({ error: 'Board not found', code: 'NOT_FOUND' }, { status: 404 });

  // 2. Buscar contato pelo telefone
  const phoneCleaned = phone.replace(/\D/g, '');
  const { data: contact, error: contactError } = await sb
    .from('contacts')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .or(`phone.ilike.%${phoneCleaned}%,phone.ilike.%${phone}%`)
    .limit(1)
    .maybeSingle();

  if (contactError) return NextResponse.json({ error: contactError.message, code: 'DB_ERROR' }, { status: 500 });
  if (!contact) return NextResponse.json({ error: 'Contact not found with this phone', code: 'NOT_FOUND' }, { status: 404 });

  // 3. Buscar deal aberto do contato no board
  const { data: deal, error: dealError } = await sb
    .from('deals')
    .select('id, tags')
    .eq('organization_id', auth.organizationId)
    .eq('board_id', board.id)
    .eq('contact_id', contact.id)
    .eq('is_won', false)
    .eq('is_lost', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dealError) return NextResponse.json({ error: dealError.message, code: 'DB_ERROR' }, { status: 500 });
  if (!deal) return NextResponse.json({ error: 'No open deal found for this contact', code: 'NOT_FOUND' }, { status: 404 });

  // 4. Verificar se tag já existe
  const currentTags: string[] = deal.tags || [];
  if (currentTags.includes(tagToAdd)) {
    return NextResponse.json({
      data: { deal_id: deal.id, tags: currentTags, action: 'already_exists' },
      message: 'Tag already exists on this deal'
    });
  }

  // 5. Adicionar a tag
  const newTags = [...currentTags, tagToAdd];

  const { data: updated, error: updateError } = await sb
    .from('deals')
    .update({ tags: newTags, updated_at: new Date().toISOString() })
    .eq('id', deal.id)
    .select('id, tags')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message, code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({
    data: { deal_id: updated.id, tags: updated.tags, action: 'added' }
  }, { status: 201 });
}

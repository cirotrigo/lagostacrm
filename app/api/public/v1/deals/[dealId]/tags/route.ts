import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/supabase/utils';
import { normalizeText } from '@/lib/public-api/sanitize';

export const runtime = 'nodejs';

const AddTagSchema = z.object({
  tag: z.string().min(1).max(100),
}).strict();

const RemoveTagSchema = z.object({
  tag: z.string().min(1).max(100),
}).strict();

/**
 * GET /api/public/v1/deals/{dealId}/tags
 * Lista as tags do deal
 */
export async function GET(request: Request, ctx: { params: Promise<{ dealId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { dealId } = await ctx.params;
  if (!isValidUUID(dealId)) {
    return NextResponse.json({ error: 'Invalid deal id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('deals')
    .select('id, tags')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .eq('id', dealId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Deal not found', code: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({ data: { deal_id: data.id, tags: data.tags || [] } });
}

/**
 * POST /api/public/v1/deals/{dealId}/tags
 * Adiciona uma tag ao deal (não duplica se já existir)
 */
export async function POST(request: Request, ctx: { params: Promise<{ dealId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { dealId } = await ctx.params;
  if (!isValidUUID(dealId)) {
    return NextResponse.json({ error: 'Invalid deal id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AddTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload. Required: { tag: string }', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const tagToAdd = normalizeText(parsed.data.tag)?.toLowerCase() || parsed.data.tag.toLowerCase();

  const sb = createStaticAdminClient();

  // Busca deal atual
  const { data: deal, error: fetchError } = await sb
    .from('deals')
    .select('id, tags')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .eq('id', dealId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message, code: 'DB_ERROR' }, { status: 500 });
  if (!deal) return NextResponse.json({ error: 'Deal not found', code: 'NOT_FOUND' }, { status: 404 });

  const currentTags: string[] = deal.tags || [];

  // Verifica se tag já existe
  if (currentTags.includes(tagToAdd)) {
    return NextResponse.json({
      data: { deal_id: deal.id, tags: currentTags, action: 'already_exists' },
      message: 'Tag already exists on this deal'
    });
  }

  // Adiciona a tag
  const newTags = [...currentTags, tagToAdd];

  const { data: updated, error: updateError } = await sb
    .from('deals')
    .update({ tags: newTags, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select('id, tags')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message, code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({
    data: { deal_id: updated.id, tags: updated.tags, action: 'added' }
  }, { status: 201 });
}

/**
 * DELETE /api/public/v1/deals/{dealId}/tags
 * Remove uma tag do deal
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ dealId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { dealId } = await ctx.params;
  if (!isValidUUID(dealId)) {
    return NextResponse.json({ error: 'Invalid deal id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RemoveTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload. Required: { tag: string }', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const tagToRemove = normalizeText(parsed.data.tag)?.toLowerCase() || parsed.data.tag.toLowerCase();

  const sb = createStaticAdminClient();

  // Busca deal atual
  const { data: deal, error: fetchError } = await sb
    .from('deals')
    .select('id, tags')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .eq('id', dealId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message, code: 'DB_ERROR' }, { status: 500 });
  if (!deal) return NextResponse.json({ error: 'Deal not found', code: 'NOT_FOUND' }, { status: 404 });

  const currentTags: string[] = deal.tags || [];

  // Verifica se tag existe
  if (!currentTags.includes(tagToRemove)) {
    return NextResponse.json({
      data: { deal_id: deal.id, tags: currentTags, action: 'not_found' },
      message: 'Tag not found on this deal'
    });
  }

  // Remove a tag
  const newTags = currentTags.filter(t => t !== tagToRemove);

  const { data: updated, error: updateError } = await sb
    .from('deals')
    .update({ tags: newTags, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select('id, tags')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message, code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({
    data: { deal_id: updated.id, tags: updated.tags, action: 'removed' }
  });
}

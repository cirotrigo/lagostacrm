import { NextResponse } from 'next/server';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/supabase/utils';

export const runtime = 'nodejs';

export async function DELETE(request: Request, ctx: { params: Promise<{ boardKeyOrId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { boardKeyOrId } = await ctx.params;
  const value = String(boardKeyOrId || '').trim();
  if (!value) return NextResponse.json({ error: 'Missing board identifier', code: 'BAD_REQUEST' }, { status: 400 });

  const sb = createStaticAdminClient();
  let query = sb
    .from('boards')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null);

  query = isValidUUID(value) ? query.eq('id', value) : query.eq('key', value);

  const { data: board, error: findError } = await query.maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message, code: 'DB_ERROR' }, { status: 500 });
  if (!board) return NextResponse.json({ error: 'Board not found', code: 'NOT_FOUND' }, { status: 404 });

  // Check for existing deals
  const { count } = await sb
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', board.id)
    .is('deleted_at', null);

  if (count && count > 0) {
    return NextResponse.json({ error: 'Cannot delete board with existing deals', code: 'HAS_DEALS' }, { status: 409 });
  }

  // Delete stages first, then soft-delete board
  await sb.from('board_stages').delete().eq('board_id', board.id);
  const { error: delError } = await sb
    .from('boards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', board.id);

  if (delError) return NextResponse.json({ error: delError.message, code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function GET(request: Request, ctx: { params: Promise<{ boardKeyOrId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { boardKeyOrId } = await ctx.params;
  const value = String(boardKeyOrId || '').trim();
  if (!value) return NextResponse.json({ error: 'Missing board identifier', code: 'BAD_REQUEST' }, { status: 400 });

  const sb = createStaticAdminClient();
  let query = sb
    .from('boards')
    .select('id,key,name,description,position,is_default,created_at,updated_at')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null);

  query = isValidUUID(value) ? query.eq('id', value) : query.eq('key', value);

  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Board not found', code: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({
    data: {
      id: (data as any).id,
      key: (data as any).key ?? null,
      name: (data as any).name,
      description: (data as any).description ?? null,
      position: (data as any).position ?? 0,
      is_default: !!(data as any).is_default,
    },
  });
}


import { NextResponse } from 'next/server';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { decodeOffsetCursor, encodeOffsetCursor, parseLimit } from '@/lib/public-api/cursor';

export const runtime = 'nodejs';

/**
 * GET /api/public/v1/products
 * Lista produtos/serviços do catálogo da organização.
 *
 * Query params:
 * - active: "true" (default) | "false" | "all" - Filtra por status ativo
 * - q: string - Busca por nome ou descrição
 * - cursor: string - Paginação
 * - limit: number - Limite de resultados (default 50, max 100)
 */
export async function GET(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const activeParam = (url.searchParams.get('active') || 'true').trim().toLowerCase();
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = decodeOffsetCursor(url.searchParams.get('cursor'));

  const sb = createStaticAdminClient();

  let query = sb
    .from('products')
    .select('id,name,description,price,sku,active,created_at,updated_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .order('name', { ascending: true });

  // Filtro de status ativo
  if (activeParam === 'true') {
    query = query.eq('active', true);
  } else if (activeParam === 'false') {
    query = query.eq('active', false);
  }
  // Se "all", não aplica filtro de active

  // Busca por nome ou descrição
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const from = offset;
  const to = offset + limit - 1;
  const { data, count, error } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  const total = count ?? 0;
  const nextOffset = to + 1;
  const nextCursor = nextOffset < total ? encodeOffsetCursor(nextOffset) : null;

  return NextResponse.json({
    data: (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      price: Number(p.price ?? 0),
      sku: p.sku ?? null,
      active: p.active ?? true,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    nextCursor,
  });
}

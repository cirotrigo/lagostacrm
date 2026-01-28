import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isValidUUID, sanitizeUUID } from '@/lib/supabase/utils';

export const runtime = 'nodejs';

const AddItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  price: z.number().min(0),
}).strict();

/**
 * GET /api/public/v1/deals/{dealId}/items
 * Lista itens (produtos/serviços) de um deal.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { dealId } = await params;
  if (!isValidUUID(dealId)) {
    return NextResponse.json({ error: 'Invalid deal_id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();

  // Verificar se o deal existe e pertence à organização
  const { data: deal, error: dealError } = await sb
    .from('deals')
    .select('id')
    .eq('id', dealId)
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .single();

  if (dealError || !deal) {
    return NextResponse.json({ error: 'Deal not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const { data, error } = await sb
    .from('deal_items')
    .select('id, deal_id, product_id, name, quantity, price, created_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  const total = (data || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return NextResponse.json({
    data: (data || []).map((item: any) => ({
      id: item.id,
      deal_id: item.deal_id,
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price),
      total: Number(item.price) * item.quantity,
      created_at: item.created_at,
    })),
    summary: {
      items_count: (data || []).length,
      total_value: total,
    },
  });
}

/**
 * POST /api/public/v1/deals/{dealId}/items
 * Adiciona um item (produto/serviço) ao deal.
 *
 * Body:
 * - product_id?: UUID do produto do catálogo (opcional para item personalizado)
 * - name: Nome do item
 * - quantity: Quantidade (default 1)
 * - price: Preço unitário
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { dealId } = await params;
  if (!isValidUUID(dealId)) {
    return NextResponse.json({ error: 'Invalid deal_id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AddItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid payload',
      code: 'VALIDATION_ERROR',
      details: parsed.error.issues,
    }, { status: 422 });
  }

  const sb = createStaticAdminClient();

  // Verificar se o deal existe e pertence à organização
  const { data: deal, error: dealError } = await sb
    .from('deals')
    .select('id, value')
    .eq('id', dealId)
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .single();

  if (dealError || !deal) {
    return NextResponse.json({ error: 'Deal not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Se product_id fornecido, buscar dados do produto
  let itemName = parsed.data.name;
  let itemPrice = parsed.data.price;
  const productId = sanitizeUUID(parsed.data.product_id);

  if (productId) {
    const { data: product } = await sb
      .from('products')
      .select('id, name, price')
      .eq('id', productId)
      .eq('organization_id', auth.organizationId)
      .single();

    if (product) {
      // Usar nome do produto se não foi fornecido nome personalizado
      if (!parsed.data.name || parsed.data.name === product.name) {
        itemName = product.name;
      }
      // Usar preço do produto se preço não foi especificado ou é 0
      if (parsed.data.price === 0 || parsed.data.price === undefined) {
        itemPrice = Number(product.price);
      }
    }
  }

  // Inserir item
  const { data: item, error: insertError } = await sb
    .from('deal_items')
    .insert({
      deal_id: dealId,
      product_id: productId || null,
      name: itemName,
      quantity: parsed.data.quantity,
      price: itemPrice,
      organization_id: auth.organizationId,
    })
    .select('id, deal_id, product_id, name, quantity, price, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message, code: 'DB_ERROR' }, { status: 500 });
  }

  // Recalcular valor total do deal
  const { data: allItems } = await sb
    .from('deal_items')
    .select('price, quantity')
    .eq('deal_id', dealId);

  const newDealValue = (allItems || []).reduce(
    (sum, i) => sum + (Number(i.price) * i.quantity),
    0
  );

  await sb
    .from('deals')
    .update({ value: newDealValue, updated_at: new Date().toISOString() })
    .eq('id', dealId);

  return NextResponse.json({
    data: {
      id: item.id,
      deal_id: item.deal_id,
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price),
      total: Number(item.price) * item.quantity,
      created_at: item.created_at,
    },
    deal_value_updated: newDealValue,
    action: 'created',
  }, { status: 201 });
}

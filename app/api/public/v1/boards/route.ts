import { NextResponse } from 'next/server';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { decodeOffsetCursor, encodeOffsetCursor, parseLimit } from '@/lib/public-api/cursor';
import { slugify } from '@/lib/utils/slugify';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const { name, description, key, stages } = body as {
    name?: string;
    description?: string;
    key?: string;
    stages?: { label: string; color?: string }[];
  };

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Missing required field: name', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const sb = createStaticAdminClient();

  // Get next position
  const { data: existingBoards } = await sb
    .from('boards')
    .select('position')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1);
  const nextPosition = existingBoards && existingBoards.length > 0 ? existingBoards[0].position + 1 : 0;

  const boardKey = slugify(key || name);

  const { data: newBoard, error: boardError } = await sb
    .from('boards')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      key: boardKey,
      organization_id: auth.organizationId,
      position: nextPosition,
      is_default: nextPosition === 0,
    })
    .select()
    .single();

  if (boardError) {
    return NextResponse.json({ error: boardError.message, code: 'DB_ERROR' }, { status: 500 });
  }

  // Create stages if provided
  let createdStages: any[] = [];
  if (Array.isArray(stages) && stages.length > 0) {
    const stagesToInsert = stages.map((s, i) => ({
      board_id: newBoard.id,
      organization_id: auth.organizationId,
      name: slugify(s.label),
      label: s.label,
      color: s.color || 'bg-gray-500',
      order: i,
    }));

    const { data: stagesData, error: stagesError } = await sb
      .from('board_stages')
      .insert(stagesToInsert)
      .select();

    if (stagesError) {
      return NextResponse.json({ error: stagesError.message, code: 'DB_ERROR' }, { status: 500 });
    }
    createdStages = (stagesData || []).map((s: any) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      order: s.order,
    }));
  }

  return NextResponse.json({
    data: {
      id: newBoard.id,
      key: newBoard.key ?? null,
      name: newBoard.name,
      description: newBoard.description ?? null,
      position: newBoard.position ?? 0,
      is_default: !!newBoard.is_default,
      stages: createdStages,
    },
  }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const key = (url.searchParams.get('key') || '').trim();
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = decodeOffsetCursor(url.searchParams.get('cursor'));
  const from = offset;
  const to = offset + limit - 1;

  const sb = createStaticAdminClient();
  let query = sb
    .from('boards')
    .select('id,key,name,description,position,is_default,created_at,updated_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (key) query = query.eq('key', key);
  if (q) query = query.or(`name.ilike.%${q}%,key.ilike.%${q}%`);

  const { data, count, error } = await query.range(from, to);
  if (error) {
    return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  }

  const total = count ?? 0;
  const nextOffset = to + 1;
  const nextCursor = nextOffset < total ? encodeOffsetCursor(nextOffset) : null;

  return NextResponse.json({
    data: (data || []).map((b: any) => ({
      id: b.id,
      key: b.key ?? null,
      name: b.name,
      description: b.description ?? null,
      position: b.position ?? 0,
      is_default: !!b.is_default,
    })),
    nextCursor,
  });
}


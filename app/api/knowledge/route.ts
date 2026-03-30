import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { generateEmbedding } from '@/lib/knowledge/embeddings';
import { parseFileContent } from '@/lib/knowledge/chunking';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledge/types';
import type { KnowledgeCategory, EntryStatus } from '@/lib/knowledge/types';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * GET /api/knowledge — List knowledge entries for the user's organization
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const search = url.searchParams.get('search') || '';
  const category = url.searchParams.get('category') as KnowledgeCategory | null;
  const status = (url.searchParams.get('status') as EntryStatus) || 'ACTIVE';
  const offset = (page - 1) * limit;

  const admin = createStaticAdminClient();

  // Build query
  let query = admin
    .from('documents')
    .select('*', { count: 'exact' })
    .eq('organization_id', profile.organization_id);

  // Filter by status in metadata
  if (status) {
    query = query.eq('metadata->>status', status);
  }

  // Filter by category in metadata
  if (category && KNOWLEDGE_CATEGORIES.includes(category)) {
    query = query.eq('metadata->>category', category);
  }

  // Text search
  if (search) {
    query = query.or(`content.ilike.%${search}%,metadata->>title.ilike.%${search}%`);
  }

  query = query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: entries, count, error } = await query;

  if (error) return json({ error: error.message }, 500);

  return json({
    entries: entries ?? [],
    pagination: { page, limit, total: count ?? 0 },
  });
}

/**
 * POST /api/knowledge — Create a new knowledge entry
 * Accepts either text content or file upload (filename + fileContent)
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const { title, content, category, tags, status, filename, fileContent } = body as {
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
    tags?: string[];
    status?: EntryStatus;
    filename?: string;
    fileContent?: string;
  };

  if (!title?.trim()) return json({ error: 'Title is required' }, 400);
  if (!category || !KNOWLEDGE_CATEGORIES.includes(category)) {
    return json({ error: 'Valid category is required' }, 400);
  }

  // Determine final content: file upload or direct text
  let finalContent: string;
  if (filename && fileContent) {
    finalContent = parseFileContent(filename, fileContent);
  } else if (content?.trim()) {
    finalContent = content.trim();
  } else {
    return json({ error: 'Content or file is required' }, 400);
  }

  // Generate embedding
  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(finalContent);
  } catch (err) {
    console.error('[knowledge] embedding generation failed:', err);
    // Continue without embedding — can be generated later
  }

  const metadata = {
    title: title.trim(),
    category,
    tags: tags ?? [],
    status: status || 'ACTIVE',
    organization_id: profile.organization_id,
  };

  const admin = createStaticAdminClient();

  const insertData: Record<string, unknown> = {
    content: finalContent,
    metadata,
    organization_id: profile.organization_id,
  };

  if (embedding) {
    insertData.embedding = JSON.stringify(embedding);
  }

  const { data: entry, error } = await admin
    .from('documents')
    .insert(insertData)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  return json({ entry }, 201);
}

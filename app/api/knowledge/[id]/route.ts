import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { generateEmbedding } from '@/lib/knowledge/embeddings';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledge/types';
import type { KnowledgeCategory, EntryStatus } from '@/lib/knowledge/types';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getAuthProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) return null;
  return profile;
}

/**
 * GET /api/knowledge/[id] — Get a single entry
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getAuthProfile(supabase);
  if (!profile) return json({ error: 'Unauthorized' }, 401);

  const admin = createStaticAdminClient();
  const { data: entry, error } = await admin
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !entry) return json({ error: 'Not found' }, 404);

  return json({ entry });
}

/**
 * PUT /api/knowledge/[id] — Update an entry
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { id } = await params;
  const supabase = await createClient();
  const profile = await getAuthProfile(supabase);
  if (!profile) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const admin = createStaticAdminClient();

  // Get existing entry to verify ownership
  const { data: existing } = await admin
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!existing) return json({ error: 'Not found' }, 404);

  const { title, content, category, tags, status } = body as {
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
    tags?: string[];
    status?: EntryStatus;
  };

  // Merge metadata
  const currentMetadata = (existing.metadata as Record<string, unknown>) ?? {};
  const updatedMetadata = { ...currentMetadata };

  if (title?.trim()) updatedMetadata.title = title.trim();
  if (category && KNOWLEDGE_CATEGORIES.includes(category)) updatedMetadata.category = category;
  if (tags !== undefined) updatedMetadata.tags = tags;
  if (status) updatedMetadata.status = status;

  const updateData: Record<string, unknown> = {
    metadata: updatedMetadata,
    updated_at: new Date().toISOString(),
  };

  // If content changed, regenerate embedding
  const contentChanged = content?.trim() && content.trim() !== existing.content;
  if (contentChanged) {
    updateData.content = content!.trim();
    try {
      const embedding = await generateEmbedding(content!.trim());
      updateData.embedding = JSON.stringify(embedding);
    } catch (err) {
      console.error('[knowledge] embedding regeneration failed:', err);
    }
  }

  const { data: entry, error } = await admin
    .from('documents')
    .update(updateData)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  return json({ entry });
}

/**
 * DELETE /api/knowledge/[id] — Delete an entry
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { id } = await params;
  const supabase = await createClient();
  const profile = await getAuthProfile(supabase);
  if (!profile) return json({ error: 'Unauthorized' }, 401);

  const admin = createStaticAdminClient();

  const { error } = await admin
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
}

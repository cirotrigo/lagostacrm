import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { generateEmbedding } from '@/lib/knowledge/embeddings';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * POST /api/knowledge/generate-embeddings
 * Generate embeddings for all documents that don't have one yet.
 * Admin-only endpoint.
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
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (profile.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const admin = createStaticAdminClient();

  // Get documents without embeddings for this organization
  const { data: docs, error } = await admin
    .from('documents')
    .select('id, content')
    .eq('organization_id', profile.organization_id)
    .is('embedding', null);

  if (error) return json({ error: error.message }, 500);

  if (!docs || docs.length === 0) {
    return json({ message: 'No documents without embeddings', processed: 0 });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const doc of docs) {
    try {
      if (!doc.content?.trim()) continue;

      const embedding = await generateEmbedding(doc.content);

      const { error: updateError } = await admin
        .from('documents')
        .update({
          embedding: JSON.stringify(embedding),
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (updateError) {
        errors.push(`${doc.id}: ${updateError.message}`);
      } else {
        processed++;
      }
    } catch (err) {
      errors.push(`${doc.id}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return json({
    message: `Processed ${processed} of ${docs.length} documents`,
    processed,
    total: docs.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

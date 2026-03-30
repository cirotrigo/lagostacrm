/**
 * Semantic search via Supabase pgvector (match_documents RPC)
 */

import { generateEmbedding } from './embeddings';
import { createStaticAdminClient } from '@/lib/supabase/server';
import type { KnowledgeCategory } from './types';

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * Search knowledge base by semantic similarity using pgvector
 */
export async function searchKnowledgeBase(
  query: string,
  organizationId: string,
  options: {
    topK?: number;
    minScore?: number;
    category?: KnowledgeCategory;
  } = {},
): Promise<SearchResult[]> {
  const { topK = 5, minScore = 0.7, category } = options;

  if (!query.trim()) return [];

  const queryEmbedding = await generateEmbedding(query);

  const supabase = createStaticAdminClient();

  const filter: Record<string, unknown> = { organization_id: organizationId };
  if (category) {
    filter.category = category;
  }

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: topK,
    filter,
  });

  if (error) {
    console.error('[knowledge/search] match_documents error:', error);
    throw new Error('Failed to search knowledge base');
  }

  return (data ?? []).filter((r: SearchResult) => r.similarity >= minScore);
}

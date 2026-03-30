'use client';

/**
 * TanStack Query hooks for knowledge base (Treinamento)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  KnowledgeListParams,
  KnowledgeListResponse,
  KnowledgeDocument,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  UploadKnowledgeFileInput,
} from '@/lib/knowledge/types';

const KNOWLEDGE_KEY = ['knowledge'] as const;

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/**
 * List knowledge entries with search/filter/pagination
 */
export function useKnowledgeEntries(
  params: KnowledgeListParams,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.search) queryParams.set('search', params.search);
  if (params.category) queryParams.set('category', params.category);
  if (params.status) queryParams.set('status', params.status);

  const qs = queryParams.toString();
  const url = `/api/knowledge${qs ? `?${qs}` : ''}`;

  return useQuery<KnowledgeListResponse>({
    queryKey: [...KNOWLEDGE_KEY, params],
    queryFn: () => apiFetch(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled,
  });
}

/**
 * Get single knowledge entry
 */
export function useKnowledgeEntry(id: string | null) {
  return useQuery<{ entry: KnowledgeDocument }>({
    queryKey: [...KNOWLEDGE_KEY, id],
    queryFn: () => apiFetch(`/api/knowledge/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Create a knowledge entry (text)
 */
export function useCreateKnowledgeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateKnowledgeInput) =>
      apiFetch('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    },
  });
}

/**
 * Upload a file as knowledge entry
 */
export function useUploadKnowledgeFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UploadKnowledgeFileInput) =>
      apiFetch('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    },
  });
}

/**
 * Update a knowledge entry
 */
export function useUpdateKnowledgeEntry(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateKnowledgeInput) =>
      apiFetch(`/api/knowledge/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    },
  });
}

/**
 * Delete a knowledge entry
 */
export function useDeleteKnowledgeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/knowledge/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    },
  });
}

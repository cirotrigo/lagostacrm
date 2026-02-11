'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConversationFilters, ConversationsResponse, WhatsAppConversationView } from '../types/messaging';

const QUERY_KEY = ['whatsapp', 'conversations'];

interface UseConversationsOptions {
  filters?: ConversationFilters;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useConversations(options: UseConversationsOptions = {}) {
  const { filters = {}, limit = 50, offset = 0, enabled = true } = options;

  return useQuery<ConversationsResponse>({
    queryKey: [...QUERY_KEY, filters, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
      if (filters.search) params.set('search', filters.search);
      if (filters.has_unread) params.set('has_unread', 'true');
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      const response = await fetch(`/api/whatsapp/conversations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    enabled,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useConversation(id: string | null) {
  return useQuery<{ data: WhatsAppConversationView }>({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/conversations/${id}`);
      if (!response.ok) throw new Error('Failed to fetch conversation');
      return response.json();
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<WhatsAppConversationView, 'status' | 'assigned_to' | 'ai_enabled'>>;
    }) => {
      const response = await fetch(`/api/whatsapp/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update conversation');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, variables.id] });
    },
  });
}

'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { MessagesResponse, WhatsAppMessage, SendMessagePayload } from '../types/messaging';

const QUERY_KEY = ['whatsapp', 'messages'];

interface UseMessagesOptions {
  conversationId: string | null;
  limit?: number;
  enabled?: boolean;
}

export function useMessages(options: UseMessagesOptions) {
  const { conversationId, limit = 50, enabled = true } = options;

  return useInfiniteQuery<MessagesResponse>({
    queryKey: [...QUERY_KEY, conversationId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('mark_as_read', 'true');
      if (pageParam) params.set('before_id', pageParam as string);

      const response = await fetch(
        `/api/whatsapp/conversations/${conversationId}/messages?${params}`
      );
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.oldest_id : undefined),
    enabled: !!conversationId && enabled,
    staleTime: 10000, // 10 seconds
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Optimistically add message to cache
      if (data.message) {
        queryClient.setQueryData(
          [...QUERY_KEY, variables.conversation_id],
          (old: { pages: MessagesResponse[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page, index) =>
                index === 0
                  ? { ...page, data: [...page.data, data.message] }
                  : page
              ),
            };
          }
        );
      }
      // Invalidate conversations to update last_message
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
    },
  });
}

// Hook to add incoming message to cache (for realtime updates)
export function useAddMessageToCache() {
  const queryClient = useQueryClient();

  return (message: WhatsAppMessage) => {
    queryClient.setQueryData(
      [...QUERY_KEY, message.conversation_id],
      (old: { pages: MessagesResponse[] } | undefined) => {
        if (!old) return old;

        // Check if message already exists
        const exists = old.pages.some(page =>
          page.data.some(m => m.id === message.id || m.wpp_message_id === message.wpp_message_id)
        );
        if (exists) return old;

        return {
          ...old,
          pages: old.pages.map((page, index) =>
            index === 0
              ? { ...page, data: [...page.data, message] }
              : page
          ),
        };
      }
    );
    // Invalidate conversations to update last_message
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
  };
}

'use client';

import { useMutation, useQueryClient, useInfiniteQuery, UseInfiniteQueryResult } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { adaptChatwootMessages, adaptChatwootMessage } from '../utils/chatwootAdapters';
import type { ChatwootMessage } from '@/lib/chatwoot';
import type { MessagesResponse, WhatsAppMessage, SendMessagePayload } from '../types/messaging';

/**
 * Hook to fetch messages for a conversation from Chatwoot
 *
 * This hook wraps the Chatwoot API and adapts the response to the
 * WhatsApp format expected by existing UI components.
 */
interface UseMessagesOptions {
    conversationId: string | null;
    limit?: number;
    enabled?: boolean;
}

export function useMessages(options: UseMessagesOptions): UseInfiniteQueryResult<{ pages: MessagesResponse[] }> {
    const { conversationId, limit = 50, enabled = true } = options;
    const numericConversationId = conversationId ? parseInt(conversationId, 10) : null;

    return useInfiniteQuery<MessagesResponse, Error, { pages: MessagesResponse[] }, readonly unknown[], string | null>({
        queryKey: [...queryKeys.chatwoot.messages(numericConversationId!), 'infinite'],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams();
            params.set('limit', limit.toString());
            if (pageParam) params.set('before', pageParam);

            const response = await fetch(
                `/api/chatwoot/conversations/${numericConversationId}/messages?${params}`
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to fetch messages');
            }

            const result = await response.json();
            const chatwootMessages: ChatwootMessage[] = result.data || [];

            // Adapt to WhatsApp format
            const adaptedMessages = adaptChatwootMessages(chatwootMessages);

            // Sort by created_at ascending (oldest first) for display
            adaptedMessages.sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            return {
                data: adaptedMessages,
                has_more: chatwootMessages.length === limit,
                oldest_id: chatwootMessages.length > 0 ? chatwootMessages[0].id.toString() : null,
            };
        },
        initialPageParam: null,
        getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.oldest_id : undefined),
        enabled: !!numericConversationId && !isNaN(numericConversationId) && enabled,
        staleTime: 10000, // 10 seconds
        refetchInterval: 30000, // Fallback: poll every 30s if realtime fails
    });
}

/**
 * Hook to send a message via Chatwoot
 */
export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: SendMessagePayload) => {
            const conversationId = parseInt(payload.conversation_id, 10);
            console.log('[useSendMessage] Sending:', {
                conversationId,
                rawId: payload.conversation_id,
                contentLength: payload.content.length,
            });

            // Validate conversationId
            if (isNaN(conversationId) || conversationId <= 0) {
                console.error('[useSendMessage] Invalid conversation ID:', payload.conversation_id);
                throw new Error('Invalid conversation ID');
            }

            let response: Response;
            try {
                response = await fetch(
                    `/api/chatwoot/conversations/${conversationId}/messages`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: payload.content,
                            private: false,
                        }),
                    }
                );
            } catch (networkError) {
                console.error('[useSendMessage] Network error:', networkError);
                throw new Error('Erro de conexão. Verifique se o servidor está rodando.');
            }

            console.log('[useSendMessage] Response status:', response.status);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                console.error('[useSendMessage] Error response:', error);
                throw new Error(error.error || 'Failed to send message');
            }

            const result = await response.json();
            console.log('[useSendMessage] Success, message ID:', result.data?.id);
            return {
                message: adaptChatwootMessage(result.data),
            };
        },
        onSuccess: (data, variables) => {
            const conversationId = parseInt(variables.conversation_id, 10);

            // Optimistically add message to cache
            if (data.message) {
                queryClient.setQueryData(
                    [...queryKeys.chatwoot.messages(conversationId), 'infinite'],
                    (old: { pages: MessagesResponse[] } | undefined) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page, index) =>
                                index === old.pages.length - 1
                                    ? { ...page, data: [...page.data, data.message] }
                                    : page
                            ),
                        };
                    }
                );
            }

            // Invalidate conversations to update last_message
            queryClient.invalidateQueries({ queryKey: queryKeys.chatwoot.conversations() });
        },
    });
}

/**
 * Hook to add incoming message to cache (for realtime updates)
 */
export function useAddMessageToCache() {
    const queryClient = useQueryClient();

    return (message: WhatsAppMessage) => {
        const conversationId = parseInt(message.conversation_id, 10);

        queryClient.setQueryData(
            [...queryKeys.chatwoot.messages(conversationId), 'infinite'],
            (old: { pages: MessagesResponse[] } | undefined) => {
                if (!old) return old;

                // Check if message already exists
                const exists = old.pages.some((page) =>
                    page.data.some((m) => m.id === message.id)
                );
                if (exists) return old;

                return {
                    ...old,
                    pages: old.pages.map((page, index) =>
                        index === old.pages.length - 1
                            ? { ...page, data: [...page.data, message] }
                            : page
                    ),
                };
            }
        );

        // Invalidate conversations to update last_message
        queryClient.invalidateQueries({ queryKey: queryKeys.chatwoot.conversations() });
    };
}

/**
 * Hook to add an incoming Chatwoot message to cache
 * Used by realtime subscription
 */
export function useAddChatwootMessageToCache() {
    const addMessageToCache = useAddMessageToCache();

    return (chatwootMessage: ChatwootMessage) => {
        const adaptedMessage = adaptChatwootMessage(chatwootMessage);
        addMessageToCache(adaptedMessage);
    };
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';

/**
 * Hook to mark all messages in a conversation as read
 *
 * @example
 * ```tsx
 * const { mutate: markAsRead } = useMarkAsRead();
 *
 * // Mark when user opens conversation
 * useEffect(() => {
 *   if (selectedConversationId) {
 *     markAsRead(selectedConversationId);
 *   }
 * }, [selectedConversationId]);
 * ```
 */
export function useMarkAsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (conversationId: number) => {
            const response = await fetch(
                `/api/messaging/conversations/${conversationId}/read`,
                { method: 'POST' }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to mark as read');
            }

            return response.json();
        },
        onSuccess: (_, conversationId) => {
            // Optimistically update the unread count in conversations list
            queryClient.setQueryData(
                queryKeys.chatwoot.conversations(),
                (old: { data: Array<{ id: number; unread_count: number }> } | undefined) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((conv) =>
                            conv.id === conversationId
                                ? { ...conv, unread_count: 0 }
                                : conv
                        ),
                    };
                }
            );

            // Also update conversation links
            queryClient.invalidateQueries({
                queryKey: queryKeys.chatwoot.conversationLinks(),
            });
        },
    });
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ChatwootConversation, ConversationStatus } from '@/lib/chatwoot';

interface ToggleStatusParams {
    conversationId: number;
    status: ConversationStatus;
}

/**
 * Hook to update conversation status
 *
 * @example
 * ```tsx
 * const { mutate: updateStatus, isPending } = useToggleStatus();
 *
 * // Resolve conversation
 * updateStatus({ conversationId: 123, status: 'resolved' });
 *
 * // Reopen conversation
 * updateStatus({ conversationId: 123, status: 'open' });
 * ```
 */
export function useToggleStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, status }: ToggleStatusParams) => {
            const response = await fetch(
                `/api/messaging/conversations/${conversationId}/status`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update conversation status');
            }

            const result = await response.json();
            return result.data as ChatwootConversation;
        },
        onSuccess: (_, { conversationId }) => {
            // Invalidate conversation queries
            queryClient.invalidateQueries({
                queryKey: queryKeys.chatwoot.conversations(),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.chatwoot.conversation(conversationId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.chatwoot.conversationLinks(),
            });
        },
    });
}

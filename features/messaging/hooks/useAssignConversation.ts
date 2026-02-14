'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ChatwootConversation } from '@/lib/chatwoot';

interface AssignConversationParams {
    conversationId: number;
    agentId: number | null; // null to unassign
}

/**
 * Hook to assign or unassign a conversation to an agent
 *
 * @example
 * ```tsx
 * const { mutate: assign, isPending } = useAssignConversation();
 *
 * // Assign to agent
 * assign({ conversationId: 123, agentId: 456 });
 *
 * // Unassign
 * assign({ conversationId: 123, agentId: null });
 * ```
 */
export function useAssignConversation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, agentId }: AssignConversationParams) => {
            const response = await fetch(
                `/api/messaging/conversations/${conversationId}/assign`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agent_id: agentId }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to assign conversation');
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

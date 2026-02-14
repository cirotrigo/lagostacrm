'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ChatwootMessage } from '@/lib/chatwoot';

interface SendPrivateNoteParams {
    conversationId: number;
    content: string;
}

/**
 * Hook to send a private note (internal message visible only to agents)
 *
 * @example
 * ```tsx
 * const { mutate: sendNote, isPending } = useSendPrivateNote();
 *
 * sendNote({
 *   conversationId: 123,
 *   content: 'Customer mentioned they prefer email contact',
 * });
 * ```
 */
export function useSendPrivateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, content }: SendPrivateNoteParams) => {
            const response = await fetch(
                `/api/messaging/conversations/${conversationId}/notes`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send private note');
            }

            const result = await response.json();
            return result.data as ChatwootMessage;
        },
        onSuccess: (newMessage, { conversationId }) => {
            // Add the note to the messages cache
            queryClient.setQueryData<ChatwootMessage[]>(
                queryKeys.chatwoot.messages(conversationId),
                (old) => (old ? [...old, newMessage] : [newMessage])
            );
        },
    });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ChatwootMessage } from '@/lib/chatwoot';

interface MessagesResponse {
    data: ChatwootMessage[];
    meta: {
        conversationId: number;
    };
}

/**
 * Hook to fetch messages for a Chatwoot conversation
 *
 * @param conversationId - Chatwoot conversation ID
 * @param enabled - Whether the query is enabled
 *
 * @example
 * ```tsx
 * const { data: messages, isLoading } = useChatwootMessages(123);
 * ```
 */
export function useChatwootMessages(
    conversationId: number | undefined,
    enabled = true
) {
    return useQuery({
        queryKey: queryKeys.chatwoot.messages(conversationId!),
        queryFn: async (): Promise<ChatwootMessage[]> => {
            const response = await fetch(
                `/api/chatwoot/conversations/${conversationId}/messages`
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch messages');
            }

            const result: MessagesResponse = await response.json();
            return result.data;
        },
        enabled: enabled && !!conversationId,
        staleTime: 10_000, // 10 seconds
        refetchInterval: 30_000, // Refetch every 30 seconds
    });
}

interface SendMessageParams {
    conversationId: number;
    content: string;
    isPrivate?: boolean;
}

/**
 * Hook to send a message to a Chatwoot conversation
 *
 * @example
 * ```tsx
 * const { mutate: sendMessage, isPending } = useSendChatwootMessage();
 *
 * sendMessage({
 *   conversationId: 123,
 *   content: 'Hello!',
 * });
 * ```
 */
export function useSendChatwootMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, content, isPrivate }: SendMessageParams) => {
            const response = await fetch(
                `/api/chatwoot/conversations/${conversationId}/messages`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content,
                        private: isPrivate ?? false,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send message');
            }

            const result = await response.json();
            return result.data as ChatwootMessage;
        },
        onSuccess: (newMessage, { conversationId }) => {
            // Optimistically add the message to the cache
            queryClient.setQueryData<ChatwootMessage[]>(
                queryKeys.chatwoot.messages(conversationId),
                (old) => (old ? [...old, newMessage] : [newMessage])
            );

            // Invalidate conversations to update last message
            queryClient.invalidateQueries({
                queryKey: queryKeys.chatwoot.conversations(),
            });
        },
    });
}

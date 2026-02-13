import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ChatwootConversation, ConversationFilters } from '@/lib/chatwoot';

interface ConversationsResponse {
    data: ChatwootConversation[];
    meta: {
        organizationId: string;
    };
}

/**
 * Hook to fetch Chatwoot conversations
 *
 * @param filters - Optional filters for conversations
 * @param enabled - Whether the query is enabled
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useChatwootConversations({ status: 'open' });
 * ```
 */
export function useChatwootConversations(
    filters?: ConversationFilters,
    enabled = true
) {
    return useQuery({
        queryKey: queryKeys.chatwoot.conversations(filters),
        queryFn: async (): Promise<ChatwootConversation[]> => {
            const params = new URLSearchParams();

            if (filters?.status) params.set('status', filters.status);
            if (filters?.inbox_id) params.set('inbox_id', filters.inbox_id.toString());
            if (filters?.page) params.set('page', filters.page.toString());

            const queryString = params.toString();
            const url = `/api/chatwoot/conversations${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch conversations');
            }

            const result: ConversationsResponse = await response.json();
            return result.data;
        },
        enabled,
        staleTime: 30_000, // 30 seconds
        refetchInterval: 60_000, // Refetch every minute
    });
}

/**
 * Hook to fetch a single Chatwoot conversation
 *
 * @param conversationId - Chatwoot conversation ID
 * @param enabled - Whether the query is enabled
 */
export function useChatwootConversation(
    conversationId: number | undefined,
    enabled = true
) {
    return useQuery({
        queryKey: queryKeys.chatwoot.conversation(conversationId!),
        queryFn: async (): Promise<ChatwootConversation> => {
            const response = await fetch(`/api/chatwoot/conversations/${conversationId}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch conversation');
            }

            const result = await response.json();
            return result.data;
        },
        enabled: enabled && !!conversationId,
        staleTime: 30_000,
    });
}

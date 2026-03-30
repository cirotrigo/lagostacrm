import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ConversationLink } from '@/lib/chatwoot';

interface ConversationLinksResponse {
    data: ConversationLink[];
}

interface ConversationLinksParams {
    contactId?: string;
    dealId?: string;
    status?: 'open' | 'resolved' | 'pending';
}

/**
 * Hook to fetch conversation links for a contact or deal
 *
 * @param params - Filter parameters
 * @param enabled - Whether the query is enabled
 *
 * @example
 * ```tsx
 * // Get conversations for a contact
 * const { data: links } = useConversationLinks({ contactId: 'uuid' });
 *
 * // Get conversations for a deal
 * const { data: links } = useConversationLinks({ dealId: 'uuid' });
 * ```
 */
export function useConversationLinks(
    params?: ConversationLinksParams,
    enabled = true
) {
    return useQuery({
        queryKey: queryKeys.chatwoot.conversationLinks(params),
        queryFn: async (): Promise<ConversationLink[]> => {
            const searchParams = new URLSearchParams();

            if (params?.contactId) searchParams.set('contact_id', params.contactId);
            if (params?.dealId) searchParams.set('deal_id', params.dealId);
            if (params?.status) searchParams.set('status', params.status);

            const queryString = searchParams.toString();
            const url = `/api/chatwoot/conversation-links${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch conversation links');
            }

            const result: ConversationLinksResponse = await response.json();
            return result.data;
        },
        enabled: enabled && !!(params?.contactId || params?.dealId),
        staleTime: 30_000,
    });
}

interface LinkToDealParams {
    conversationLinkId: string;
    dealId: string;
}

interface LinkToContactParams {
    conversationLinkId: string;
    contactId: string;
}

/**
 * Hook to link a conversation to a deal
 */
export function useLinkConversationToDeal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationLinkId, dealId }: LinkToDealParams) => {
            const response = await fetch('/api/chatwoot/conversation-links', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: conversationLinkId,
                    deal_id: dealId,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to link conversation to deal');
            }

            const result = await response.json();
            return result.data as ConversationLink;
        },
        onSuccess: (_, { dealId }) => {
            // Invalidate the conversation links for the deal
            queryClient.invalidateQueries({
                queryKey: queryKeys.chatwoot.conversationLinks({ dealId }),
            });
        },
    });
}

/**
 * Hook to link a conversation to a contact
 */
export function useLinkConversationToContact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationLinkId, contactId }: LinkToContactParams) => {
            const response = await fetch('/api/chatwoot/conversation-links', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: conversationLinkId,
                    contact_id: contactId,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to link conversation to contact');
            }

            const result = await response.json();
            return result.data as ConversationLink;
        },
        onSuccess: (_, { contactId }) => {
            // Invalidate the conversation links for the contact
            queryClient.invalidateQueries({
                queryKey: queryKeys.chatwoot.conversationLinks({ contactId }),
            });
        },
    });
}

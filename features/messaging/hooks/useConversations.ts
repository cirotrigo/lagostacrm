'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { adaptChatwootConversations, adaptChatwootConversation } from '../utils/chatwootAdapters';
import type { ChatwootConversation, ConversationStatus } from '@/lib/chatwoot';
import type { ConversationFilters, ConversationsResponse, WhatsAppConversationView } from '../types/messaging';

/**
 * Hook to fetch conversations from Chatwoot
 *
 * This hook wraps the Chatwoot API and adapts the response to the
 * WhatsApp format expected by existing UI components.
 */
interface UseConversationsOptions {
    filters?: ConversationFilters;
    limit?: number;
    offset?: number;
    enabled?: boolean;
}

export function useConversations(options: UseConversationsOptions = {}): UseQueryResult<ConversationsResponse> {
    const { filters = {}, limit = 50, offset = 0, enabled = true } = options;

    // Map our filter format to Chatwoot's format
    const chatwootFilters: { status?: ConversationStatus; inbox_id?: number; page?: number } = {};
    if (filters.status && filters.status !== 'all') {
        // Map WhatsApp status to Chatwoot status
        chatwootFilters.status = filters.status as ConversationStatus;
    }
    if (offset > 0) {
        chatwootFilters.page = Math.floor(offset / limit) + 1;
    }

    const selectConversations = useMemo(
        () => (adaptedConversations: WhatsAppConversationView[]): ConversationsResponse => {
            let filteredConversations = adaptedConversations;

            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                filteredConversations = filteredConversations.filter(
                    (conv) =>
                        conv.contact_name?.toLowerCase().includes(searchLower) ||
                        conv.contact_phone?.toLowerCase().includes(searchLower) ||
                        conv.remote_jid?.toLowerCase().includes(searchLower) ||
                        conv.last_message_preview?.toLowerCase().includes(searchLower)
                );
            }

            if (filters.has_unread) {
                filteredConversations = filteredConversations.filter(
                    (conv) => conv.unread_count > 0
                );
            }

            if (filters.source && filters.source !== 'all') {
                filteredConversations = filteredConversations.filter(
                    (conv) => conv.messaging_source === filters.source
                );
            }

            return {
                data: filteredConversations,
                total: filteredConversations.length,
                limit,
                offset,
            };
        },
        [filters.search, filters.has_unread, filters.source, limit, offset]
    );

    return useQuery<WhatsAppConversationView[], Error, ConversationsResponse>({
        queryKey: [...queryKeys.chatwoot.conversations(chatwootFilters), limit, offset],
        queryFn: async () => {
            const params = new URLSearchParams();

            if (chatwootFilters.status) params.set('status', chatwootFilters.status);
            if (chatwootFilters.page) params.set('page', chatwootFilters.page.toString());

            const queryString = params.toString();
            const url = `/api/chatwoot/conversations${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to fetch conversations');
            }

            const result = await response.json();
            const chatwootConversations: ChatwootConversation[] = result.data;

            // Adapt to WhatsApp format
            return adaptChatwootConversations(chatwootConversations);
        },
        select: selectConversations,
        enabled,
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // 1 minute
    });
}

/**
 * Hook to fetch a single conversation by ID
 */
export function useConversation(id: string | null): UseQueryResult<{ data: WhatsAppConversationView }> {
    const conversationId = id ? parseInt(id, 10) : null;

    return useQuery<{ data: WhatsAppConversationView }>({
        queryKey: queryKeys.chatwoot.conversation(conversationId!),
        queryFn: async () => {
            const response = await fetch(`/api/chatwoot/conversations/${conversationId}`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to fetch conversation');
            }

            const result = await response.json();
            const chatwootConversation: ChatwootConversation = result.data;

            return {
                data: adaptChatwootConversation(chatwootConversation),
            };
        },
        enabled: !!conversationId && !isNaN(conversationId),
        staleTime: 30000,
    });
}

/**
 * Hook to update a conversation (status, assignment, etc.)
 */
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
            const conversationId = parseInt(id, 10);

            // Map updates to Chatwoot format
            const chatwootUpdates: { status?: ConversationStatus; assignee_id?: number } = {};
            if (updates.status) {
                chatwootUpdates.status = updates.status as ConversationStatus;
            }
            if (updates.assigned_to) {
                chatwootUpdates.assignee_id = parseInt(updates.assigned_to, 10);
            }

            const response = await fetch(`/api/chatwoot/conversations/${conversationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatwootUpdates),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to update conversation');
            }

            const result = await response.json();
            return adaptChatwootConversation(result.data);
        },
        onSuccess: (_, variables) => {
            // Invalidate all conversation queries
            queryClient.invalidateQueries({ queryKey: queryKeys.chatwoot.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.chatwoot.conversation(parseInt(variables.id, 10)) });
        },
    });
}

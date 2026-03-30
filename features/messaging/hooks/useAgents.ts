'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ChatwootAgent } from '@/lib/chatwoot';

/**
 * Hook to fetch available agents for conversation assignment
 *
 * @param inboxId - Optional inbox ID to filter agents
 * @param enabled - Whether the query is enabled
 *
 * @example
 * ```tsx
 * const { data: agents, isLoading } = useAgents();
 *
 * // Filter by inbox
 * const { data: inboxAgents } = useAgents(123);
 * ```
 */
export function useAgents(inboxId?: number, enabled = true) {
    return useQuery({
        queryKey: ['messaging', 'agents', inboxId] as const,
        queryFn: async (): Promise<ChatwootAgent[]> => {
            const params = new URLSearchParams();
            if (inboxId) {
                params.set('inbox_id', inboxId.toString());
            }

            const queryString = params.toString();
            const url = `/api/messaging/agents${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch agents');
            }

            const result = await response.json();
            return result.data;
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes - agents don't change often
    });
}

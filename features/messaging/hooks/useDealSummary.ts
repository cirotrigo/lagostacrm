'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

interface DealSummary {
    id: string;
    title: string;
    value: number;
    stage_id: string;
    board_id: string;
    status: string;
}

/**
 * Hook to fetch minimal deal data needed for stage selector
 *
 * Returns board_id and stage_id which are required to:
 * 1. Load the board's stages via useBoard(boardId)
 * 2. Identify current stage for the selector
 * 3. Move the deal via useMoveDeal
 */
export function useDealSummary(dealId: string | null) {
    return useQuery<DealSummary | null>({
        queryKey: ['deal-summary', dealId],
        queryFn: async () => {
            if (!dealId) return null;

            const { data, error } = await supabase
                .from('deals')
                .select('id, title, value, status, board_id')
                .eq('id', dealId)
                .single();

            if (error) {
                console.error('[useDealSummary] Error fetching deal:', error);
                return null;
            }

            return {
                id: data.id,
                title: data.title,
                value: data.value,
                stage_id: data.status, // In this schema, status = stage_id
                board_id: data.board_id,
                status: data.status,
            };
        },
        enabled: !!dealId,
        staleTime: 30000, // 30 seconds
    });
}

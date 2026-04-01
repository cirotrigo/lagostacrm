import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';
import type { ConversationFilters, ChatwootConversation } from '@/lib/chatwoot';

/**
 * GET /api/chatwoot/conversations
 *
 * List conversations from Chatwoot for the current user's organization.
 * Fetches from ALL configured inboxes and merges results.
 *
 * Query params:
 * - status: 'open' | 'resolved' | 'pending' | 'snoozed'
 * - inbox_id: number (optional, filter to specific inbox)
 * - page: number
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Auth do usuario
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // 2. Buscar org do usuario
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json(
                { error: 'No organization found' },
                { status: 400 }
            );
        }

        // 3. Buscar TODAS as configs ativas da org
        const { getAllChannelConfigs } = await import('@/lib/chatwoot/config');
        const allConfigs = (await getAllChannelConfigs(supabase, profile.organization_id))
            .filter(c => c.status === 'active');

        if (allConfigs.length === 0) {
            throw new Error('No active Chatwoot configuration found for organization');
        }

        const chatwoot = await createChatwootClientForOrg(
            supabase,
            profile.organization_id
        );

        // 4. Parse query params
        const { searchParams } = new URL(request.url);
        const baseFilters: ConversationFilters = {};

        const status = searchParams.get('status');
        if (status && ['open', 'resolved', 'pending', 'snoozed'].includes(status)) {
            baseFilters.status = status as ConversationFilters['status'];
        }

        const page = searchParams.get('page');
        if (page) {
            baseFilters.page = parseInt(page, 10);
        }

        const inboxId = searchParams.get('inbox_id');

        // 5. Buscar conversas
        let conversations: ChatwootConversation[];

        if (inboxId) {
            // Filtro explícito por inbox
            conversations = await chatwoot.getConversations({
                ...baseFilters,
                inbox_id: parseInt(inboxId, 10),
            });
        } else {
            // Buscar de TODOS os inboxes configurados
            const inboxIds = allConfigs
                .map(c => c.chatwootInboxId)
                .filter((id): id is number => id != null);

            if (inboxIds.length === 1) {
                conversations = await chatwoot.getConversations({
                    ...baseFilters,
                    inbox_id: inboxIds[0],
                });
            } else if (inboxIds.length > 1) {
                // Fetch em paralelo de cada inbox e merge
                const results = await Promise.all(
                    inboxIds.map(id =>
                        chatwoot.getConversations({ ...baseFilters, inbox_id: id })
                    )
                );
                conversations = results.flat();
                // Ordenar por last_activity_at desc
                conversations.sort((a, b) => {
                    const dateA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
                    const dateB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
                    return dateB - dateA;
                });
            } else {
                // Nenhum inbox configurado, buscar sem filtro
                conversations = await chatwoot.getConversations(baseFilters);
            }
        }

        return NextResponse.json({
            data: conversations,
            meta: {
                organizationId: profile.organization_id,
            },
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);

        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('No active Chatwoot configuration')) {
            return NextResponse.json(
                { error: 'Chatwoot not configured for this organization' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch conversations' },
            { status: 500 }
        );
    }
}

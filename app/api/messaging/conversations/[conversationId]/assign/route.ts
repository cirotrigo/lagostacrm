import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ conversationId: string }>;
}

/**
 * POST /api/messaging/conversations/[conversationId]/assign
 *
 * Assign or unassign a conversation to an agent
 *
 * Body:
 * - agent_id: number | null (null to unassign)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { conversationId: idParam } = await params;
        const conversationId = parseInt(idParam, 10);

        if (isNaN(conversationId)) {
            return NextResponse.json(
                { error: 'Invalid conversation ID' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get org
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization' }, { status: 400 });
        }

        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);

        // Parse body
        const body = await request.json();
        const agentId = body.agent_id;

        let conversation;
        let agentName: string | null = null;

        if (agentId === null || agentId === undefined) {
            // Unassign
            conversation = await chatwoot.unassignConversation(conversationId);
        } else {
            // Assign
            conversation = await chatwoot.assignConversation(conversationId, agentId);

            // Get agent name for local cache update
            if (conversation.assignee) {
                agentName = conversation.assignee.name;
            }
        }

        // Update local conversation link with assignment info
        await supabase
            .from('messaging_conversation_links')
            .update({
                assigned_agent_id: agentId || null,
                assigned_agent_name: agentName,
                updated_at: new Date().toISOString(),
            })
            .eq('organization_id', profile.organization_id)
            .eq('chatwoot_conversation_id', conversationId);

        return NextResponse.json({
            data: conversation,
            meta: {
                assigned: !!agentId,
                agentId: agentId || null,
                agentName,
            },
        });
    } catch (error) {
        console.error('Error assigning conversation:', error);
        return NextResponse.json(
            { error: 'Failed to assign conversation' },
            { status: 500 }
        );
    }
}

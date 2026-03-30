import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';
import type { ConversationStatus } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ conversationId: string }>;
}

/**
 * POST /api/messaging/conversations/[conversationId]/status
 *
 * Update conversation status
 *
 * Body:
 * - status: 'open' | 'resolved' | 'pending' | 'snoozed'
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

        // Parse body
        const body = await request.json();
        const status = body.status as ConversationStatus;

        if (!status || !['open', 'resolved', 'pending', 'snoozed'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be one of: open, resolved, pending, snoozed' },
                { status: 400 }
            );
        }

        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);

        // Update status in Chatwoot
        const conversation = await chatwoot.updateConversationStatus(conversationId, status);

        // Update local conversation link with new status
        // Map Chatwoot status to our local status (we don't have 'snoozed')
        const localStatus = status === 'snoozed' ? 'pending' : status;

        await supabase
            .from('messaging_conversation_links')
            .update({
                status: localStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('organization_id', profile.organization_id)
            .eq('chatwoot_conversation_id', conversationId);

        return NextResponse.json({
            data: conversation,
            meta: {
                previousStatus: body.previous_status,
                newStatus: status,
            },
        });
    } catch (error) {
        console.error('Error updating conversation status:', error);
        return NextResponse.json(
            { error: 'Failed to update conversation status' },
            { status: 500 }
        );
    }
}

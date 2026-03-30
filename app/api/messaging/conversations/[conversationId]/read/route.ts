import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ conversationId: string }>;
}

/**
 * POST /api/messaging/conversations/[conversationId]/read
 *
 * Mark all messages in a conversation as read
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

        // Mark messages as read in Chatwoot
        await chatwoot.markMessagesAsRead(conversationId);

        // Reset unread count locally
        await supabase.rpc('reset_unread_count', {
            p_organization_id: profile.organization_id,
            p_chatwoot_conversation_id: conversationId,
        });

        return NextResponse.json({
            success: true,
            meta: {
                conversationId,
                markedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        return NextResponse.json(
            { error: 'Failed to mark messages as read' },
            { status: 500 }
        );
    }
}

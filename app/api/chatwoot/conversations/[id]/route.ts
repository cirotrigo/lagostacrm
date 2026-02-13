import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/chatwoot/conversations/[id]
 *
 * Get a single conversation by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const conversationId = parseInt(id, 10);

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

        // Fetch conversation
        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);
        const conversation = await chatwoot.getConversation(conversationId);

        return NextResponse.json({ data: conversation });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conversation' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/chatwoot/conversations/[id]
 *
 * Update conversation (status, assignment)
 *
 * Body:
 * - status: 'open' | 'resolved' | 'pending' | 'snoozed'
 * - assignee_id: number
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const conversationId = parseInt(id, 10);

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
        let conversation;

        if (body.status) {
            conversation = await chatwoot.updateConversationStatus(
                conversationId,
                body.status
            );
        }

        if (body.assignee_id) {
            conversation = await chatwoot.assignConversation(
                conversationId,
                body.assignee_id
            );
        }

        return NextResponse.json({ data: conversation });
    } catch (error) {
        console.error('Error updating conversation:', error);
        return NextResponse.json(
            { error: 'Failed to update conversation' },
            { status: 500 }
        );
    }
}

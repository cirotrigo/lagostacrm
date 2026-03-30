import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/chatwoot/conversations/[id]/messages
 *
 * Get messages for a conversation
 *
 * Query params:
 * - before: number (message ID for pagination)
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

        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);

        // Parse pagination
        const { searchParams } = new URL(request.url);
        const before = searchParams.get('before');
        const beforeId = before ? parseInt(before, 10) : undefined;

        // Fetch messages
        const messages = await chatwoot.getMessages(conversationId, beforeId);

        // Debug log to verify message types
        console.log('[Messages API] Fetched messages:', {
            conversationId,
            count: messages.length,
            messageBreakdown: {
                incoming: messages.filter(m => m.message_type === 'incoming' || m.message_type === 0).length,
                outgoing: messages.filter(m => m.message_type === 'outgoing' || m.message_type === 1).length,
                other: messages.filter(m => !['incoming', 'outgoing', 0, 1].includes(m.message_type as never)).length,
            },
            sampleMessages: messages.slice(0, 5).map(m => ({
                id: m.id,
                type: m.message_type,
                typeOf: typeof m.message_type,
                content: m.content?.substring(0, 30),
            })),
        });

        return NextResponse.json({
            data: messages,
            meta: {
                conversationId,
            },
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/chatwoot/conversations/[id]/messages
 *
 * Send a message to a conversation
 *
 * Body:
 * - content: string (required)
 * - private: boolean (optional, default false)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

        if (!body.content || typeof body.content !== 'string') {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            );
        }

        // Send message
        const message = await chatwoot.sendTextMessage(
            conversationId,
            body.content,
            body.private ?? false
        );

        return NextResponse.json({ data: message }, { status: 201 });
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json(
            { error: 'Failed to send message' },
            { status: 500 }
        );
    }
}

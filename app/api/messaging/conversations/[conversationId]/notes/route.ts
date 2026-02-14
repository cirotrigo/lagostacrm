import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ conversationId: string }>;
}

/**
 * POST /api/messaging/conversations/[conversationId]/notes
 *
 * Send a private note (internal message visible only to agents)
 *
 * Body:
 * - content: string (the note content)
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

        // Get org and profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, name')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization' }, { status: 400 });
        }

        // Parse body
        const body = await request.json();
        const content = body.content;

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            );
        }

        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);

        // Send private note
        const message = await chatwoot.sendPrivateNote(conversationId, content.trim());

        // Also cache the message locally
        await supabase.rpc('upsert_message_cache', {
            p_organization_id: profile.organization_id,
            p_chatwoot_message_id: message.id,
            p_chatwoot_conversation_id: conversationId,
            p_content: message.content || '',
            p_content_type: message.content_type || 'text',
            p_message_type: 'outgoing',
            p_is_private: true,
            p_attachments: JSON.stringify(message.attachments || []),
            p_sender_type: 'user',
            p_sender_id: message.sender && 'id' in message.sender ? message.sender.id : null,
            p_sender_name: profile.name || user.email,
            p_created_at: new Date(message.created_at * 1000).toISOString(),
        });

        return NextResponse.json({
            data: message,
            meta: {
                isPrivate: true,
                senderName: profile.name || user.email,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Error sending private note:', error);
        return NextResponse.json(
            { error: 'Failed to send private note' },
            { status: 500 }
        );
    }
}

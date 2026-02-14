import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ conversationId: string }>;
}

/**
 * GET /api/messaging/conversations/[conversationId]/messages
 *
 * Get messages for a conversation
 *
 * Query params:
 * - before: Message ID to fetch messages before (for pagination)
 * - limit: Number of messages to fetch (default: 50)
 * - use_cache: If 'true', fetch from local cache instead of Chatwoot API
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

        const searchParams = request.nextUrl.searchParams;
        const beforeParam = searchParams.get('before');
        const useCache = searchParams.get('use_cache') === 'true';

        if (useCache) {
            // Fetch from local cache
            let query = supabase
                .from('messaging_messages_cache')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .eq('chatwoot_conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (beforeParam) {
                const beforeId = parseInt(beforeParam, 10);
                query = query.lt('chatwoot_message_id', beforeId);
            }

            const { data: cachedMessages, error: cacheError } = await query;

            if (cacheError) {
                console.error('Cache fetch error:', cacheError);
                // Fall through to Chatwoot API
            } else if (cachedMessages && cachedMessages.length > 0) {
                return NextResponse.json({
                    data: cachedMessages.reverse(), // Return oldest first
                    meta: {
                        conversationId,
                        source: 'cache',
                        count: cachedMessages.length,
                    },
                });
            }
        }

        // Fetch from Chatwoot API
        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);
        const beforeId = beforeParam ? parseInt(beforeParam, 10) : undefined;
        const messages = await chatwoot.getMessages(conversationId, beforeId);

        // Cache the messages for future use
        for (const msg of messages) {
            const senderType = msg.sender
                ? ('email' in msg.sender ? 'user' : 'contact')
                : null;
            const senderId = msg.sender?.id || null;
            const senderName = msg.sender?.name || null;

            await supabase.rpc('upsert_message_cache', {
                p_organization_id: profile.organization_id,
                p_chatwoot_message_id: msg.id,
                p_chatwoot_conversation_id: conversationId,
                p_content: msg.content || '',
                p_content_type: msg.content_type || 'text',
                p_message_type: msg.message_type,
                p_is_private: msg.private || false,
                p_attachments: JSON.stringify(msg.attachments || []),
                p_sender_type: senderType,
                p_sender_id: senderId,
                p_sender_name: senderName,
                p_created_at: new Date(msg.created_at * 1000).toISOString(),
            });
        }

        // Mark messages as read
        try {
            await chatwoot.markMessagesAsRead(conversationId);

            // Reset unread count locally
            await supabase.rpc('reset_unread_count', {
                p_organization_id: profile.organization_id,
                p_chatwoot_conversation_id: conversationId,
            });
        } catch (e) {
            // Non-critical, don't fail the request
            console.warn('Failed to mark messages as read:', e);
        }

        return NextResponse.json({
            data: messages,
            meta: {
                conversationId,
                source: 'chatwoot',
                count: messages.length,
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
 * POST /api/messaging/conversations/[conversationId]/messages
 *
 * Send a message to a conversation
 *
 * Body:
 * - content: string (required)
 * - private: boolean (optional, for private notes)
 * - attachments: Array<{ file_type: string; data_url: string }> (optional)
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
        const isPrivate = body.private || false;
        const attachments = body.attachments;

        if (!content && !attachments?.length) {
            return NextResponse.json(
                { error: 'Content or attachments are required' },
                { status: 400 }
            );
        }

        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);

        // Send message
        let message;
        if (attachments?.length) {
            message = await chatwoot.sendMessageWithAttachments(
                conversationId,
                content || '',
                attachments,
                isPrivate
            );
        } else {
            message = await chatwoot.sendTextMessage(
                conversationId,
                content,
                isPrivate
            );
        }

        // Cache the sent message
        await supabase.rpc('upsert_message_cache', {
            p_organization_id: profile.organization_id,
            p_chatwoot_message_id: message.id,
            p_chatwoot_conversation_id: conversationId,
            p_content: message.content || '',
            p_content_type: message.content_type || 'text',
            p_message_type: 'outgoing',
            p_is_private: isPrivate,
            p_attachments: JSON.stringify(message.attachments || []),
            p_sender_type: 'user',
            p_sender_id: message.sender && 'id' in message.sender ? message.sender.id : null,
            p_sender_name: profile.name || user.email,
            p_created_at: new Date(message.created_at * 1000).toISOString(),
        });

        // Update conversation link with last message preview
        await supabase.rpc('update_conversation_link_from_message', {
            p_organization_id: profile.organization_id,
            p_chatwoot_conversation_id: conversationId,
            p_content: content || '[Attachment]',
            p_message_type: 'outgoing',
            p_created_at: new Date(message.created_at * 1000).toISOString(),
        });

        return NextResponse.json({
            data: message,
            meta: {
                senderName: profile.name || user.email,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json(
            { error: 'Failed to send message' },
            { status: 500 }
        );
    }
}

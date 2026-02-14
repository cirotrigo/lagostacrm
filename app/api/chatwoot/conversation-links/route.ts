import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import type { ConversationLink } from '@/lib/chatwoot';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Validates request authentication.
 * Supports both Supabase user auth and n8n API key auth.
 *
 * For n8n: Use Authorization: Bearer <N8N_WEBHOOK_SECRET> + X-Organization-Id header
 */
async function validateAuth(request: NextRequest): Promise<{
    supabase: SupabaseClient;
    organizationId: string;
} | { error: string; status: number }> {
    // Check multiple possible auth headers
    const authHeader = request.headers.get('Authorization');
    const xApiKey = request.headers.get('x-api-key');
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET || process.env.CRM_API_KEY;

    // Check for API key auth (n8n uses x-api-key header via "Coronel CRM" credential)
    const providedKey = xApiKey || (authHeader?.startsWith('Bearer ')
        ? authHeader.replace('Bearer ', '')
        : authHeader);

    if (providedKey && expectedSecret && providedKey === expectedSecret) {
        const organizationId = request.headers.get('X-Organization-Id');
        if (!organizationId) {
            return { error: 'X-Organization-Id header required for API key auth', status: 400 };
        }

        // Debug: Check if env vars are set
        const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
        const hasKey = !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
        console.log('[validateAuth] Creating admin client - URL:', hasUrl, 'Key:', hasKey);

        return {
            supabase: createStaticAdminClient(),
            organizationId,
        };
    }

    // Fall back to Supabase user auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'Unauthorized', status: 401 };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return { error: 'No organization', status: 400 };
    }

    return {
        supabase,
        organizationId: profile.organization_id,
    };
}

/**
 * Database row type for messaging_conversation_links
 */
interface DbConversationLink {
    id: string;
    organization_id: string;
    chatwoot_conversation_id: number;
    chatwoot_contact_id: number | null;
    chatwoot_inbox_id: number | null;
    contact_id: string | null;
    deal_id: string | null;
    last_message_at: string | null;
    last_message_preview: string | null;
    last_message_sender: 'customer' | 'agent' | null;
    status: 'open' | 'resolved' | 'pending';
    unread_count: number;
    chatwoot_url: string | null;
    created_at: string;
    updated_at: string;
}

function toConversationLink(row: DbConversationLink): ConversationLink {
    return {
        id: row.id,
        organizationId: row.organization_id,
        chatwootConversationId: row.chatwoot_conversation_id,
        chatwootContactId: row.chatwoot_contact_id ?? undefined,
        chatwootInboxId: row.chatwoot_inbox_id ?? undefined,
        contactId: row.contact_id ?? undefined,
        dealId: row.deal_id ?? undefined,
        lastMessageAt: row.last_message_at ?? undefined,
        lastMessagePreview: row.last_message_preview ?? undefined,
        lastMessageSender: row.last_message_sender ?? undefined,
        status: row.status,
        unreadCount: row.unread_count,
        chatwootUrl: row.chatwoot_url ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * GET /api/chatwoot/conversation-links
 *
 * Get conversation links for contacts or deals.
 *
 * Query params:
 * - contact_id: Filter by CRM contact ID
 * - deal_id: Filter by CRM deal ID
 * - status: Filter by status ('open', 'resolved', 'pending')
 */
export async function GET(request: NextRequest) {
    try {
        // Auth (supports both Supabase user and n8n API key)
        const authResult = await validateAuth(request);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { supabase, organizationId } = authResult;

        const { searchParams } = new URL(request.url);
        const contactId = searchParams.get('contact_id');
        const dealId = searchParams.get('deal_id');
        const status = searchParams.get('status');

        // Build query
        let query = supabase
            .from('messaging_conversation_links')
            .select('*')
            .eq('organization_id', organizationId)
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (contactId) {
            query = query.eq('contact_id', contactId);
        }

        if (dealId) {
            query = query.eq('deal_id', dealId);
        }

        if (status && ['open', 'resolved', 'pending'].includes(status)) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return NextResponse.json({
            data: (data as DbConversationLink[]).map(toConversationLink),
        });
    } catch (error) {
        console.error('Error fetching conversation links:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conversation links' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/chatwoot/conversation-links
 *
 * Create or update a conversation link.
 *
 * Body:
 * - chatwoot_conversation_id: number (required)
 * - chatwoot_contact_id: number (optional)
 * - chatwoot_inbox_id: number (optional)
 * - contact_id: string (optional)
 * - deal_id: string (optional)
 * - chatwoot_url: string (optional)
 * - contact_avatar_url: string (optional) - Will sync to CRM contact's avatar if contact_id is provided
 */
export async function POST(request: NextRequest) {
    try {
        // Auth (supports both Supabase user and n8n API key)
        const authResult = await validateAuth(request);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { supabase, organizationId } = authResult;

        // Parse body
        const body = await request.json();

        if (!body.chatwoot_conversation_id) {
            return NextResponse.json(
                { error: 'chatwoot_conversation_id is required' },
                { status: 400 }
            );
        }

        // Helper to convert empty strings to null (n8n sends "" for undefined)
        const emptyToNull = (val: unknown) => (val === '' || val === undefined) ? null : val;

        // Log the data being inserted
        const insertData = {
            organization_id: organizationId,
            chatwoot_conversation_id: body.chatwoot_conversation_id,
            chatwoot_contact_id: emptyToNull(body.chatwoot_contact_id),
            chatwoot_inbox_id: emptyToNull(body.chatwoot_inbox_id),
            contact_id: emptyToNull(body.contact_id),
            deal_id: emptyToNull(body.deal_id),
            chatwoot_url: emptyToNull(body.chatwoot_url),
            status: body.status || 'open',
        };
        console.log('[POST] Upserting conversation link:', JSON.stringify(insertData, null, 2));

        // Upsert conversation link
        const { data, error } = await supabase
            .from('messaging_conversation_links')
            .upsert(insertData, {
                onConflict: 'organization_id,chatwoot_conversation_id',
            })
            .select()
            .single<DbConversationLink>();

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return NextResponse.json(
                { error: 'Failed to create conversation link', details: error.message, code: error.code },
                { status: 500 }
            );
        }

        // Sync contact avatar from Chatwoot if provided
        const contactAvatarUrl = emptyToNull(body.contact_avatar_url) as string | null;
        const contactId = emptyToNull(body.contact_id) as string | null;

        if (contactId && contactAvatarUrl) {
            console.log('[POST] Syncing contact avatar:', { contactId, avatarUrl: contactAvatarUrl });

            // Check if contact already has an avatar (don't overwrite if already set)
            const { data: existingContact } = await supabase
                .from('contacts')
                .select('avatar')
                .eq('id', contactId)
                .single();

            // Only update if contact exists and doesn't have an avatar yet
            if (existingContact && !existingContact.avatar) {
                const { error: avatarError } = await supabase
                    .from('contacts')
                    .update({ avatar: contactAvatarUrl, updated_at: new Date().toISOString() })
                    .eq('id', contactId);

                if (avatarError) {
                    console.error('[POST] Failed to sync contact avatar:', avatarError);
                    // Don't fail the request, just log the error
                } else {
                    console.log('[POST] Contact avatar synced successfully');
                }
            }
        }

        return NextResponse.json({ data: toConversationLink(data) }, { status: 201 });
    } catch (error) {
        console.error('Error creating conversation link:', error);
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        return NextResponse.json(
            { error: 'Failed to create conversation link', details: message },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/chatwoot/conversation-links
 *
 * Update a conversation link (link to contact/deal).
 *
 * Body:
 * - id: string (required)
 * - contact_id: string (optional)
 * - deal_id: string (optional)
 */
export async function PATCH(request: NextRequest) {
    try {
        // Auth (supports both Supabase user and n8n API key)
        const authResult = await validateAuth(request);
        if ('error' in authResult) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { supabase } = authResult;

        // Parse body
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { error: 'id is required' },
                { status: 400 }
            );
        }

        // Build update object
        const updates: Record<string, unknown> = {};
        if (body.contact_id !== undefined) updates.contact_id = body.contact_id;
        if (body.deal_id !== undefined) updates.deal_id = body.deal_id;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        // Update
        const { data, error } = await supabase
            .from('messaging_conversation_links')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single<DbConversationLink>();

        if (error) {
            throw error;
        }

        return NextResponse.json({ data: toConversationLink(data) });
    } catch (error) {
        console.error('Error updating conversation link:', error);
        return NextResponse.json(
            { error: 'Failed to update conversation link' },
            { status: 500 }
        );
    }
}

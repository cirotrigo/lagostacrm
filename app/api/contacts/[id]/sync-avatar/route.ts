import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/contacts/[id]/sync-avatar
 *
 * Sync contact avatar from Chatwoot.
 * Looks for a conversation link with this contact and fetches the Chatwoot contact's thumbnail.
 *
 * Body (optional):
 * - force: boolean - If true, overwrite existing avatar
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id: contactId } = await params;

        const supabase = await createClient();

        // Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's organization
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization' }, { status: 400 });
        }

        const organizationId = profile.organization_id;

        // Parse body
        const body = await request.json().catch(() => ({}));
        const force = body.force === true;

        // Get current contact
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id, avatar')
            .eq('id', contactId)
            .eq('organization_id', organizationId)
            .single();

        if (contactError || !contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Check if avatar already exists and force is not set
        if (contact.avatar && !force) {
            return NextResponse.json({
                message: 'Contact already has an avatar',
                avatar: contact.avatar,
                synced: false,
            });
        }

        // Find conversation link for this contact
        const { data: conversationLink, error: linkError } = await supabase
            .from('messaging_conversation_links')
            .select('chatwoot_contact_id')
            .eq('contact_id', contactId)
            .eq('organization_id', organizationId)
            .not('chatwoot_contact_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (linkError || !conversationLink?.chatwoot_contact_id) {
            return NextResponse.json({
                error: 'No Chatwoot contact linked to this CRM contact',
                synced: false,
            }, { status: 404 });
        }

        // Get Chatwoot client
        const chatwoot = await createChatwootClientForOrg(supabase, organizationId);

        // Fetch Chatwoot contact
        const chatwootContact = await chatwoot.getContact(conversationLink.chatwoot_contact_id);

        if (!chatwootContact?.thumbnail) {
            return NextResponse.json({
                error: 'Chatwoot contact has no thumbnail',
                synced: false,
            }, { status: 404 });
        }

        // Update CRM contact avatar
        const { error: updateError } = await supabase
            .from('contacts')
            .update({
                avatar: chatwootContact.thumbnail,
                updated_at: new Date().toISOString(),
            })
            .eq('id', contactId);

        if (updateError) {
            console.error('[sync-avatar] Failed to update contact:', updateError);
            return NextResponse.json({
                error: 'Failed to update contact avatar',
                details: updateError.message,
            }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Avatar synced successfully',
            avatar: chatwootContact.thumbnail,
            synced: true,
        });
    } catch (error) {
        console.error('[sync-avatar] Error:', error);
        return NextResponse.json(
            { error: 'Failed to sync avatar' },
            { status: 500 }
        );
    }
}

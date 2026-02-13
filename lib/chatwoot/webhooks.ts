import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    ChatwootWebhookPayload,
    ConversationLink,
} from './types';

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

/**
 * Transform database row to application type
 */
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
 * Validate Chatwoot webhook signature
 *
 * @param payload - Raw request body
 * @param signature - X-Chatwoot-Signature header
 * @param secret - Webhook secret
 * @returns true if signature is valid
 */
export function validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    // Chatwoot uses HMAC-SHA256 for webhook signatures
    // For now, we'll do a simple secret comparison if no signature provided
    // TODO: Implement proper HMAC validation
    if (!signature || !secret) {
        return true; // Skip validation if not configured
    }

    // Simple bearer token check
    return signature === secret || signature === `Bearer ${secret}`;
}

/**
 * Process a Chatwoot webhook event
 *
 * Handles conversation and message events to sync with the CRM.
 *
 * @param supabase - Supabase client (admin)
 * @param organizationId - Organization ID
 * @param payload - Webhook payload
 * @param chatwootBaseUrl - Base URL for building deep links
 */
export async function processWebhookEvent(
    supabase: SupabaseClient,
    organizationId: string,
    payload: ChatwootWebhookPayload,
    chatwootBaseUrl: string
): Promise<void> {
    const { event, conversation, message, contact } = payload;

    switch (event) {
        case 'conversation_created':
            if (conversation) {
                await handleConversationCreated(
                    supabase,
                    organizationId,
                    conversation,
                    chatwootBaseUrl
                );
            }
            break;

        case 'conversation_status_changed':
        case 'conversation_updated':
            if (conversation) {
                await handleConversationUpdated(
                    supabase,
                    organizationId,
                    conversation
                );
            }
            break;

        case 'message_created':
            if (conversation && message) {
                await handleMessageCreated(
                    supabase,
                    organizationId,
                    conversation,
                    message
                );
            }
            break;

        case 'contact_created':
        case 'contact_updated':
            if (contact) {
                await handleContactSync(supabase, organizationId, contact);
            }
            break;

        default:
            // Ignore other events
            break;
    }
}

/**
 * Handle conversation_created event
 */
async function handleConversationCreated(
    supabase: SupabaseClient,
    organizationId: string,
    conversation: ChatwootWebhookPayload['conversation'],
    chatwootBaseUrl: string
): Promise<void> {
    if (!conversation) return;

    const chatwootUrl = `${chatwootBaseUrl}/app/accounts/${conversation.account_id}/conversations/${conversation.id}`;

    // Try to find matching CRM contact by phone
    let contactId: string | null = null;
    const senderPhone = conversation.meta?.sender?.phone_number;

    if (senderPhone) {
        const { data: crmContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('phone', senderPhone)
            .single();

        if (crmContact) {
            contactId = crmContact.id;
        }
    }

    // Upsert conversation link
    await supabase.from('messaging_conversation_links').upsert({
        organization_id: organizationId,
        chatwoot_conversation_id: conversation.id,
        chatwoot_contact_id: conversation.meta?.sender?.id,
        chatwoot_inbox_id: conversation.inbox_id,
        contact_id: contactId,
        status: mapStatus(conversation.status),
        unread_count: conversation.unread_count || 0,
        chatwoot_url: chatwootUrl,
    }, {
        onConflict: 'organization_id,chatwoot_conversation_id',
    });
}

/**
 * Handle conversation_updated event
 */
async function handleConversationUpdated(
    supabase: SupabaseClient,
    organizationId: string,
    conversation: ChatwootWebhookPayload['conversation']
): Promise<void> {
    if (!conversation) return;

    await supabase
        .from('messaging_conversation_links')
        .update({
            status: mapStatus(conversation.status),
            unread_count: conversation.unread_count || 0,
        })
        .eq('organization_id', organizationId)
        .eq('chatwoot_conversation_id', conversation.id);
}

/**
 * Handle message_created event
 */
async function handleMessageCreated(
    supabase: SupabaseClient,
    organizationId: string,
    conversation: ChatwootWebhookPayload['conversation'],
    message: ChatwootWebhookPayload['message']
): Promise<void> {
    if (!conversation || !message) return;

    const sender = message.message_type === 'incoming' ? 'customer' : 'agent';
    const preview = message.content?.substring(0, 100) || '';

    await supabase
        .from('messaging_conversation_links')
        .update({
            last_message_at: new Date(message.created_at * 1000).toISOString(),
            last_message_preview: preview,
            last_message_sender: sender,
            unread_count: sender === 'customer'
                ? supabase.rpc('increment_unread', {
                    org_id: organizationId,
                    conv_id: conversation.id,
                })
                : 0,
        })
        .eq('organization_id', organizationId)
        .eq('chatwoot_conversation_id', conversation.id);
}

/**
 * Handle contact sync (contact_created or contact_updated)
 */
async function handleContactSync(
    supabase: SupabaseClient,
    organizationId: string,
    contact: ChatwootWebhookPayload['contact']
): Promise<void> {
    if (!contact?.phone_number) return;

    // Find CRM contact by phone
    const { data: crmContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone', contact.phone_number)
        .single();

    if (!crmContact) return;

    // Update all conversation links for this Chatwoot contact
    await supabase
        .from('messaging_conversation_links')
        .update({ contact_id: crmContact.id })
        .eq('organization_id', organizationId)
        .eq('chatwoot_contact_id', contact.id);
}

/**
 * Map Chatwoot status to our simplified status
 */
function mapStatus(
    status?: string
): 'open' | 'resolved' | 'pending' {
    switch (status) {
        case 'resolved':
            return 'resolved';
        case 'pending':
        case 'snoozed':
            return 'pending';
        default:
            return 'open';
    }
}

/**
 * Get conversation links for a contact
 */
export async function getConversationLinksForContact(
    supabase: SupabaseClient,
    contactId: string
): Promise<ConversationLink[]> {
    const { data, error } = await supabase
        .from('messaging_conversation_links')
        .select('*')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false });

    if (error || !data) {
        return [];
    }

    return data.map(toConversationLink);
}

/**
 * Get conversation links for a deal
 */
export async function getConversationLinksForDeal(
    supabase: SupabaseClient,
    dealId: string
): Promise<ConversationLink[]> {
    const { data, error } = await supabase
        .from('messaging_conversation_links')
        .select('*')
        .eq('deal_id', dealId)
        .order('last_message_at', { ascending: false });

    if (error || !data) {
        return [];
    }

    return data.map(toConversationLink);
}

/**
 * Link a conversation to a deal
 */
export async function linkConversationToDeal(
    supabase: SupabaseClient,
    conversationLinkId: string,
    dealId: string
): Promise<void> {
    const { error } = await supabase
        .from('messaging_conversation_links')
        .update({ deal_id: dealId })
        .eq('id', conversationLinkId);

    if (error) {
        throw new Error(`Failed to link conversation to deal: ${error.message}`);
    }
}

/**
 * Link a conversation to a contact
 */
export async function linkConversationToContact(
    supabase: SupabaseClient,
    conversationLinkId: string,
    contactId: string
): Promise<void> {
    const { error } = await supabase
        .from('messaging_conversation_links')
        .update({ contact_id: contactId })
        .eq('id', conversationLinkId);

    if (error) {
        throw new Error(`Failed to link conversation to contact: ${error.message}`);
    }
}

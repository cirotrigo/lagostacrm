import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    ChatwootWebhookPayload,
    ConversationLink,
} from './types';
import {
    resolveContactByIdentity,
    linkContactToIdentity,
    type MessagingSource,
} from '@/lib/messaging';
import { normalizeChatwootAvatarUrl, needsChatwootAvatarRewrite } from './avatarUrl';

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
    const { event, conversation, message, contact, inbox } = payload;

    switch (event) {
        case 'conversation_created':
            if (conversation) {
                await handleConversationCreated(
                    supabase,
                    organizationId,
                    conversation,
                    inbox?.channel_type,
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
                await handleContactSync(
                    supabase,
                    organizationId,
                    contact,
                    chatwootBaseUrl
                );
            }
            break;

        default:
            // Ignore other events
            break;
    }
}

/**
 * Handle conversation_created event with multi-channel identity resolution.
 *
 * Resolution priority:
 * 1. Exact match in messaging_contact_identities table
 * 2. Fallback to phone lookup (for WhatsApp and when phone available)
 * 3. Auto-create contact with identity link
 */
async function handleConversationCreated(
    supabase: SupabaseClient,
    organizationId: string,
    conversation: ChatwootWebhookPayload['conversation'],
    inboxChannelType: string | undefined,
    chatwootBaseUrl: string
): Promise<void> {
    if (!conversation) return;

    const chatwootUrl = `${chatwootBaseUrl}/app/accounts/${conversation.account_id}/conversations/${conversation.id}`;
    const sender = conversation.meta?.sender;
    const normalizedSenderThumbnail = normalizeChatwootAvatarUrl(
        sender?.thumbnail ?? null,
        chatwootBaseUrl
    );

    // Determine channel source from webhook inbox or conversation metadata
    const channelType = inboxChannelType ?? conversation.meta?.channel ?? '';
    const source: MessagingSource | null = detectMessagingSource(channelType);

    // Extract external identifier based on source
    let externalId: string | null = null;
    if (source === 'INSTAGRAM' && sender?.identifier) {
        // Instagram: use IGSID from identifier field
        externalId = sender.identifier;
    } else if (source === 'WHATSAPP' && sender?.phone_number) {
        // WhatsApp: use phone number
        externalId = sender.phone_number;
    }

    // Try identity resolution if we have a valid source and external_id
    let contactId: string | null = null;

    if (source && externalId) {
        const resolution = await resolveContactByIdentity(supabase, {
            organizationId,
            source,
            externalId,
            phone: sender?.phone_number ?? null,
            email: sender?.email ?? null,
            contactName: sender?.name ?? null,
            contactAvatar: normalizedSenderThumbnail,
            autoCreate: true, // Create contact if not found
            createIdentity: true, // Create identity mapping if resolved via fallback
        });

        if (resolution.ok) {
            contactId = resolution.data.contactId;
            console.log('[Webhook] Identity resolved:', {
                contactId,
                method: resolution.data.resolutionMethod,
                source,
                externalId,
            });
        } else {
            console.warn('[Webhook] Identity resolution failed:', {
                error: resolution.error,
                code: resolution.code,
                source,
                externalId,
            });
        }
    } else if (sender?.phone_number) {
        // Fallback: legacy phone-based lookup (backward compatibility for unknown channels)
        const { data: crmContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('phone', sender.phone_number)
            .is('deleted_at', null)
            .maybeSingle();

        if (crmContact) {
            contactId = crmContact.id;

            // Create identity link for future lookups if we know the source
            if (source && externalId) {
                await linkContactToIdentity(supabase, {
                    organizationId,
                    contactId: crmContact.id,
                    source,
                    externalId,
                });
            }
        }
    }

    // Upsert conversation link with extended fields
    await supabase.from('messaging_conversation_links').upsert({
        organization_id: organizationId,
        chatwoot_conversation_id: conversation.id,
        chatwoot_contact_id: sender?.id,
        chatwoot_inbox_id: conversation.inbox_id,
        contact_id: contactId,
        status: mapStatus(conversation.status),
        unread_count: conversation.unread_count || 0,
        chatwoot_url: chatwootUrl,
        // Extended fields for embedded chat
        assigned_agent_id: conversation.assignee?.id || null,
        assigned_agent_name: conversation.assignee?.name || null,
        inbox_name: null, // Would need inbox lookup
        contact_name: sender?.name || null,
        contact_phone: sender?.phone_number || null,
        contact_avatar_url: normalizedSenderThumbnail,
    }, {
        onConflict: 'organization_id,chatwoot_conversation_id',
    });
}

/**
 * Detect messaging source from Chatwoot channel type.
 *
 * @param channelType - Chatwoot inbox channel_type (e.g., 'Channel::Instagram', 'Channel::Whatsapp')
 * @returns MessagingSource or null if unknown
 */
function detectMessagingSource(channelType: string): MessagingSource | null {
    const normalized = channelType.toLowerCase();

    if (normalized.includes('instagram')) {
        return 'INSTAGRAM';
    }

    if (normalized.includes('whatsapp') || normalized.includes('wpp')) {
        return 'WHATSAPP';
    }

    // Unknown channel type
    return null;
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
            assigned_agent_id: conversation.assignee?.id || null,
            assigned_agent_name: conversation.assignee?.name || null,
        })
        .eq('organization_id', organizationId)
        .eq('chatwoot_conversation_id', conversation.id);
}

/**
 * Handle message_created event
 *
 * This function:
 * 1. Updates the conversation link with the last message preview
 * 2. Caches the message for realtime sync
 * 3. Increments unread count for incoming messages
 */
async function handleMessageCreated(
    supabase: SupabaseClient,
    organizationId: string,
    conversation: ChatwootWebhookPayload['conversation'],
    message: ChatwootWebhookPayload['message']
): Promise<void> {
    if (!conversation || !message) return;

    const isIncoming = message.message_type === 'incoming';
    const sender = isIncoming ? 'customer' : 'agent';
    const preview = message.content?.substring(0, 100) || '';
    const messageTimestamp = new Date(message.created_at * 1000).toISOString();

    // 1. Cache the message for realtime sync
    // Determine sender type and info
    const senderType = message.sender
        ? ('email' in message.sender ? 'user' : 'contact')
        : null;
    const senderId = message.sender?.id || null;
    const senderName = message.sender?.name || null;

    console.log('[Webhook] Caching message for realtime:', {
        messageId: message.id,
        conversationId: conversation.id,
        messageType: message.message_type,
        contentPreview: message.content?.substring(0, 30),
    });

    try {
        const result = await supabase.rpc('upsert_message_cache', {
            p_organization_id: organizationId,
            p_chatwoot_message_id: message.id,
            p_chatwoot_conversation_id: conversation.id,
            p_content: message.content || '',
            p_content_type: message.content_type || 'text',
            p_message_type: message.message_type,
            p_is_private: message.private || false,
            p_attachments: JSON.stringify(message.attachments || []),
            p_sender_type: senderType,
            p_sender_id: senderId,
            p_sender_name: senderName,
            p_created_at: messageTimestamp,
        });
        console.log('[Webhook] Message cached successfully:', {
            messageId: message.id,
            result,
        });
    } catch (error) {
        console.warn('[Webhook] Failed to cache message:', error);
        // Non-critical, continue with conversation update
    }

    // 2. Update conversation link with last message info
    try {
        await supabase.rpc('update_conversation_link_from_message', {
            p_organization_id: organizationId,
            p_chatwoot_conversation_id: conversation.id,
            p_content: preview,
            p_message_type: message.message_type,
            p_created_at: messageTimestamp,
        });
    } catch (error) {
        // Fall back to direct update if RPC not available
        console.warn('RPC not available, using direct update:', error);
        await supabase
            .from('messaging_conversation_links')
            .update({
                last_message_at: messageTimestamp,
                last_message_preview: preview,
                last_message_sender: sender,
            })
            .eq('organization_id', organizationId)
            .eq('chatwoot_conversation_id', conversation.id);
    }

    // 3. Increment unread count for incoming messages
    if (isIncoming) {
        try {
            await supabase.rpc('increment_unread_count', {
                p_organization_id: organizationId,
                p_chatwoot_conversation_id: conversation.id,
            });
        } catch (error) {
            console.warn('Failed to increment unread count:', error);
        }
    }
}

/**
 * Handle contact sync (contact_created or contact_updated)
 *
 * Syncs Chatwoot contact updates to CRM, including identity linking.
 */
async function handleContactSync(
    supabase: SupabaseClient,
    organizationId: string,
    contact: ChatwootWebhookPayload['contact'],
    chatwootBaseUrl: string
): Promise<void> {
    if (!contact?.phone_number) return;

    // Find CRM contact by phone (with organization isolation)
    const { data: crmContact } = await supabase
        .from('contacts')
        .select('id,avatar')
        .eq('organization_id', organizationId)
        .eq('phone', contact.phone_number)
        .is('deleted_at', null)
        .maybeSingle();

    if (!crmContact) return;

    const normalizedAvatar = normalizeChatwootAvatarUrl(
        contact.thumbnail ?? null,
        chatwootBaseUrl
    );
    const existingAvatar = (crmContact.avatar || '').trim();
    const shouldUpdateAvatar = Boolean(
        normalizedAvatar &&
        (!existingAvatar || needsChatwootAvatarRewrite(existingAvatar, chatwootBaseUrl))
    );

    if (shouldUpdateAvatar) {
        await supabase
            .from('contacts')
            .update({
                avatar: normalizedAvatar,
                updated_at: new Date().toISOString(),
            })
            .eq('organization_id', organizationId)
            .eq('id', crmContact.id);
    }

    // Create WhatsApp identity link if phone is available
    // This ensures future lookups can use the identity table
    await linkContactToIdentity(supabase, {
        organizationId,
        contactId: crmContact.id,
        source: 'WHATSAPP',
        externalId: contact.phone_number,
    });

    // Update all conversation links for this Chatwoot contact
    const linkUpdates: Record<string, unknown> = { contact_id: crmContact.id };
    if (normalizedAvatar) {
        linkUpdates.contact_avatar_url = normalizedAvatar;
        linkUpdates.updated_at = new Date().toISOString();
    }
    await supabase
        .from('messaging_conversation_links')
        .update(linkUpdates)
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

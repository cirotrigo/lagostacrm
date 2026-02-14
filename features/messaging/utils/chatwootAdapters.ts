/**
 * Chatwoot to WhatsApp Type Adapters
 *
 * These functions convert Chatwoot API types to the WhatsApp types
 * expected by the existing messaging components, allowing a gradual
 * migration without rewriting all UI components.
 */

import type {
    ChatwootConversation,
    ChatwootMessage,
    ConversationStatus,
} from '@/lib/chatwoot';
import type {
    WhatsAppConversationView,
    WhatsAppMessage,
    WhatsAppConversationStatus,
    MessageDirection,
    WhatsAppMediaType,
    WhatsAppMessageStatus,
} from '@/types/types';

/**
 * Maps Chatwoot conversation status to WhatsApp status
 */
function mapConversationStatus(status: ConversationStatus): WhatsAppConversationStatus {
    const statusMap: Record<ConversationStatus, WhatsAppConversationStatus> = {
        open: 'open',
        resolved: 'resolved',
        pending: 'pending',
        snoozed: 'pending', // Map snoozed to pending
    };
    return statusMap[status] || 'open';
}

/**
 * Maps Chatwoot message type to message direction
 */
function mapMessageDirection(messageType: string): MessageDirection {
    return messageType === 'incoming' ? 'inbound' : 'outbound';
}

/**
 * Maps Chatwoot attachment file_type to WhatsApp media type
 */
function mapMediaType(fileType?: string, contentType?: string): WhatsAppMediaType {
    if (!fileType && !contentType) return 'text';

    const type = fileType || contentType || '';

    if (type.includes('image')) return 'image';
    if (type.includes('audio')) return 'audio';
    if (type.includes('video')) return 'video';
    if (type.includes('document') || type.includes('file')) return 'document';
    if (type.includes('location')) return 'location';
    if (type.includes('contact')) return 'contact';

    return 'text';
}

/**
 * Maps Chatwoot message status to WhatsApp message status
 */
function mapMessageStatus(status?: string): WhatsAppMessageStatus {
    const statusMap: Record<string, WhatsAppMessageStatus> = {
        sent: 'sent',
        delivered: 'delivered',
        read: 'read',
        failed: 'failed',
    };
    return statusMap[status || ''] || 'sent';
}

/**
 * Converts a Chatwoot conversation to WhatsAppConversationView format
 */
export function adaptChatwootConversation(
    conversation: ChatwootConversation
): WhatsAppConversationView {
    const contact = conversation.meta?.sender || conversation.contact;
    const lastMessage = conversation.messages?.[0];

    return {
        // Base fields
        id: conversation.id.toString(),
        organization_id: '', // Not available from Chatwoot, will be filled by caller
        session_id: conversation.inbox_id.toString(),
        contact_id: contact?.id?.toString() || null,
        deal_id: null, // Will be filled from conversation_links if available
        remote_jid: contact?.phone_number || contact?.identifier || '',
        is_group: false, // Chatwoot doesn't expose this directly in conversations
        group_name: null,
        status: mapConversationStatus(conversation.status),
        assigned_to: conversation.assignee?.id?.toString() || null,
        ai_enabled: false, // Default, not available from Chatwoot
        unread_count: conversation.unread_count,
        total_messages: conversation.messages?.length || 0,
        last_message_at: conversation.last_activity_at
            ? new Date(conversation.last_activity_at).toISOString()
            : null,
        last_message_preview: lastMessage?.content?.substring(0, 100) || null,
        last_message_direction: lastMessage
            ? mapMessageDirection(lastMessage.message_type)
            : null,
        created_at: new Date(conversation.created_at * 1000).toISOString(),
        updated_at: conversation.last_activity_at || new Date().toISOString(),

        // View extension fields
        contact_name: contact?.name || null,
        contact_phone: contact?.phone_number || null,
        contact_email: contact?.email || null,
        contact_avatar: contact?.thumbnail || null,
        deal_title: null, // Will be filled from conversation_links
        deal_value: null,
        deal_stage: null,
        session_name: `Inbox ${conversation.inbox_id}`, // Could be enhanced with inbox lookup
        session_phone: null,
    };
}

/**
 * Converts a Chatwoot message to WhatsAppMessage format
 */
export function adaptChatwootMessage(message: ChatwootMessage): WhatsAppMessage {
    const attachment = message.attachments?.[0];
    const isFromMe = message.message_type === 'outgoing';
    const sender = message.sender;

    // Determine media type
    let mediaType: WhatsAppMediaType = 'text';
    if (attachment) {
        mediaType = mapMediaType(attachment.file_type);
    }

    return {
        id: message.id.toString(),
        conversation_id: message.conversation_id.toString(),
        wpp_message_id: null, // Not available from Chatwoot
        direction: mapMessageDirection(message.message_type),
        media_type: mediaType,
        content: message.content || null,
        caption: null, // Not directly available
        media_url: attachment?.data_url || null,
        media_mime_type: attachment?.extension ? `application/${attachment.extension}` : null,
        media_filename: null, // Not directly available
        media_size_bytes: attachment?.file_size || null,
        location_lat: null, // Could parse from content_attributes if needed
        location_lng: null,
        location_name: null,
        status: mapMessageStatus(message.status),
        status_updated_at: null,
        error_message: null,
        sender_jid: sender && 'phone_number' in sender ? sender.phone_number || null : null,
        sender_name: sender?.name || null,
        sender_phone: sender && 'phone_number' in sender ? sender.phone_number || null : null,
        quoted_message_id: null, // Not directly available
        is_from_me: isFromMe,
        is_forwarded: false, // Not available from Chatwoot
        is_broadcast: false, // Not available from Chatwoot
        wpp_timestamp: new Date(message.created_at * 1000).toISOString(),
        created_at: new Date(message.created_at * 1000).toISOString(),
    };
}

/**
 * Batch convert Chatwoot conversations
 */
export function adaptChatwootConversations(
    conversations: ChatwootConversation[]
): WhatsAppConversationView[] {
    return conversations.map(adaptChatwootConversation);
}

/**
 * Batch convert Chatwoot messages
 */
export function adaptChatwootMessages(messages: ChatwootMessage[]): WhatsAppMessage[] {
    return messages.map(adaptChatwootMessage);
}

/**
 * Chatwoot Integration Library
 *
 * Provides a typed client and utilities for integrating with Chatwoot API.
 *
 * @example
 * ```typescript
 * import { createChatwootClientForOrg, ChatwootClient } from '@/lib/chatwoot';
 *
 * // Create client from organization config
 * const chatwoot = await createChatwootClientForOrg(supabase, orgId);
 *
 * // List open conversations
 * const conversations = await chatwoot.getConversations({ status: 'open' });
 *
 * // Send a message
 * await chatwoot.sendTextMessage(conversationId, 'Hello!');
 * ```
 */

// Client
export { ChatwootClient } from './client';

// Configuration
export {
    createChatwootClientForOrg,
    createChatwootClientFromEnv,
    getChannelConfig,
    getChannelConfigByType,
    getChannelConfigByInbox,
    getChannelConfigByAccountId,
    getAllChannelConfigs,
    saveChannelConfig,
    updateChannelStatus,
} from './config';

// Webhooks
export {
    validateWebhookSignature,
    processWebhookEvent,
    getConversationLinksForContact,
    getConversationLinksForDeal,
    linkConversationToDeal,
    linkConversationToContact,
} from './webhooks';

// Types
export type {
    // Config types
    ChatwootConfig,
    ChatwootChannelConfig,

    // Contact types
    ChatwootContact,
    ChatwootContactPayload,

    // Conversation types
    ChatwootConversation,
    ConversationStatus,
    ConversationFilters,
    ConversationsResponse,

    // Message types
    ChatwootMessage,
    ChatwootAttachment,
    MessageType,
    ContentType,
    MessageStatus,
    MessagesResponse,
    SendMessagePayload,

    // Agent & Team types
    ChatwootAgent,
    ChatwootTeam,

    // Inbox types
    ChatwootInbox,
    ChatwootWorkingHour,

    // Label types
    ChatwootLabel,
    AddLabelsPayload,

    // Webhook types
    WebhookEvent,
    ChatwootWebhookPayload,

    // Error types
    ChatwootApiError,

    // CRM Link types
    ConversationLink,
    LabelMap,
    LabelSyncLog,
} from './types';

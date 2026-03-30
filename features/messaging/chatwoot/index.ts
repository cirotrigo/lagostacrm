/**
 * Chatwoot Messaging Feature
 *
 * This module provides components and hooks for integrating Chatwoot
 * messaging into the CRM. It's designed to work alongside the existing
 * WPPConnect messaging integration.
 *
 * Key features:
 * - ConversationTimeline: Read-only timeline for contacts/deals
 * - Hooks for fetching conversations and messages
 * - Integration with Chatwoot API via /api/chatwoot routes
 *
 * @example
 * ```tsx
 * import { ConversationTimeline, useConversationLinks } from '@/features/messaging/chatwoot';
 *
 * // In a contact view
 * <ConversationTimeline contactId={contact.id} />
 *
 * // Or use the hook directly
 * const { data: links } = useConversationLinks({ dealId: deal.id });
 * ```
 */

// Components
export { ConversationTimeline } from './components';

// Hooks
export {
    useChatwootConversations,
    useChatwootConversation,
    useChatwootMessages,
    useSendChatwootMessage,
    useConversationLinks,
    useLinkConversationToDeal,
    useLinkConversationToContact,
} from './hooks';

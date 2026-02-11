// Re-export types from main types file for convenience
export type {
  WhatsAppSession,
  WhatsAppSessionStatus,
  WhatsAppConversation,
  WhatsAppConversationView,
  WhatsAppConversationStatus,
  WhatsAppMessage,
  WhatsAppMediaType,
  WhatsAppMessageStatus,
  MessageDirection,
  SendMessagePayload,
  ConversationFilters,
  ConversationsResponse,
  MessagesResponse,
} from '@/types/types';

// Additional local types for the messaging feature

export interface ConversationListItem extends WhatsAppConversationView {
  isSelected?: boolean;
}

export interface MessageGroup {
  date: string;
  messages: WhatsAppMessage[];
}

export interface TypingIndicator {
  conversationId: string;
  isTyping: boolean;
  timestamp: number;
}

// Re-import for local use
import type { WhatsAppConversationView, WhatsAppMessage } from '@/types/types';

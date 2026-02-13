/**
 * Chatwoot API Types
 * Based on Chatwoot API v1 documentation
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ChatwootConfig {
    baseUrl: string;
    token: string;
    accountId: number;
    inboxId?: number;
}

export interface ChatwootChannelConfig {
    id: string;
    organizationId: string;
    chatwootBaseUrl: string;
    chatwootApiToken: string;
    chatwootAccountId: number;
    chatwootInboxId?: number;
    wppconnectBaseUrl?: string;
    wppconnectToken?: string;
    wppconnectSession?: string;
    channelType: string;
    name: string;
    status: 'active' | 'inactive' | 'error';
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Contact Types
// ============================================================================

export interface ChatwootContact {
    id: number;
    name: string;
    email?: string;
    phone_number?: string;
    thumbnail?: string;
    custom_attributes?: Record<string, unknown>;
    additional_attributes?: Record<string, unknown>;
    availability_status?: 'online' | 'offline' | 'busy';
    identifier?: string;
    created_at: string;
    last_activity_at?: string;
}

export interface ChatwootContactPayload {
    inbox_id: number;
    name?: string;
    email?: string;
    phone_number?: string;
    identifier?: string;
    custom_attributes?: Record<string, unknown>;
}

// ============================================================================
// Conversation Types
// ============================================================================

export type ConversationStatus = 'open' | 'resolved' | 'pending' | 'snoozed';

export interface ChatwootConversation {
    id: number;
    account_id: number;
    inbox_id: number;
    status: ConversationStatus;
    assignee?: ChatwootAgent;
    team?: ChatwootTeam;
    contact_last_seen_at?: string;
    agent_last_seen_at?: string;
    unread_count: number;
    last_activity_at?: string;
    additional_attributes?: Record<string, unknown>;
    custom_attributes?: Record<string, unknown>;
    labels: string[];
    meta: {
        sender: ChatwootContact;
        channel?: string;
        assignee?: ChatwootAgent;
    };
    messages?: ChatwootMessage[];
    created_at: number;
    can_reply: boolean;
    contact: ChatwootContact;
}

export interface ConversationFilters {
    status?: ConversationStatus;
    inbox_id?: number;
    assignee_type?: 'me' | 'unassigned' | 'all';
    page?: number;
    labels?: string[];
}

export interface ConversationsResponse {
    data: {
        meta: {
            mine_count: number;
            unassigned_count: number;
            all_count: number;
        };
        payload: ChatwootConversation[];
    };
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType = 'incoming' | 'outgoing' | 'activity' | 'template';
export type ContentType = 'text' | 'input_select' | 'cards' | 'form' | 'article' | 'input_email' | 'input_csat';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatwootAttachment {
    id: number;
    message_id: number;
    file_type: 'image' | 'video' | 'audio' | 'file' | 'location' | 'fallback';
    account_id: number;
    extension?: string;
    data_url: string;
    thumb_url?: string;
    file_size?: number;
}

export interface ChatwootMessage {
    id: number;
    content?: string;
    content_type?: ContentType;
    content_attributes?: Record<string, unknown>;
    message_type: MessageType;
    created_at: number;
    private: boolean;
    attachments?: ChatwootAttachment[];
    sender?: ChatwootContact | ChatwootAgent;
    conversation_id: number;
    status?: MessageStatus;
}

export interface MessagesResponse {
    meta: {
        contact_last_seen_at?: number;
    };
    payload: ChatwootMessage[];
}

export interface SendMessagePayload {
    content: string;
    message_type?: 'outgoing' | 'incoming';
    private?: boolean;
    content_attributes?: Record<string, unknown>;
    attachments?: Array<{
        file_type: string;
        data_url: string;
    }>;
    template_params?: Record<string, unknown>;
}

// ============================================================================
// Agent & Team Types
// ============================================================================

export interface ChatwootAgent {
    id: number;
    uid: string;
    name: string;
    email: string;
    account_id: number;
    role: 'administrator' | 'agent';
    confirmed: boolean;
    availability_status?: 'online' | 'offline' | 'busy';
    auto_offline: boolean;
    custom_attributes?: Record<string, unknown>;
    thumbnail?: string;
}

export interface ChatwootTeam {
    id: number;
    name: string;
    description?: string;
    allow_auto_assign: boolean;
    account_id: number;
    is_member: boolean;
}

// ============================================================================
// Inbox Types
// ============================================================================

export interface ChatwootInbox {
    id: number;
    avatar_url?: string;
    channel_id: number;
    name: string;
    channel_type: string;
    greeting_enabled: boolean;
    greeting_message?: string;
    working_hours_enabled: boolean;
    enable_email_collect: boolean;
    csat_survey_enabled: boolean;
    enable_auto_assignment: boolean;
    out_of_office_message?: string;
    working_hours?: ChatwootWorkingHour[];
    timezone?: string;
    callback_webhook_url?: string;
    allow_messages_after_resolved: boolean;
    lock_to_single_conversation: boolean;
    phone_number?: string;
}

export interface ChatwootWorkingHour {
    day_of_week: number;
    closed_all_day?: boolean;
    open_hour?: number;
    open_minutes?: number;
    close_hour?: number;
    close_minutes?: number;
    open_all_day?: boolean;
}

// ============================================================================
// Label Types
// ============================================================================

export interface ChatwootLabel {
    id: number;
    title: string;
    description?: string;
    color: string;
    show_on_sidebar: boolean;
}

export interface AddLabelsPayload {
    labels: string[];
}

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookEvent =
    | 'conversation_created'
    | 'conversation_status_changed'
    | 'conversation_updated'
    | 'message_created'
    | 'message_updated'
    | 'webwidget_triggered'
    | 'contact_created'
    | 'contact_updated';

export interface ChatwootWebhookPayload {
    event: WebhookEvent;
    account: {
        id: number;
        name: string;
    };
    inbox?: ChatwootInbox;
    conversation?: ChatwootConversation;
    message?: ChatwootMessage;
    contact?: ChatwootContact;
    sender?: ChatwootContact | ChatwootAgent;
    changed_attributes?: Array<{
        previous_value: unknown;
        current_value: unknown;
    }>;
    timestamp?: string;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface ChatwootApiError {
    success: false;
    error?: string;
    errors?: string[];
    description?: string;
}

// ============================================================================
// CRM Link Types (for Supabase)
// ============================================================================

export interface ConversationLink {
    id: string;
    organizationId: string;
    chatwootConversationId: number;
    chatwootContactId?: number;
    chatwootInboxId?: number;
    contactId?: string;
    dealId?: string;
    lastMessageAt?: string;
    lastMessagePreview?: string;
    lastMessageSender?: 'customer' | 'agent';
    status: 'open' | 'resolved' | 'pending';
    unreadCount: number;
    chatwootUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LabelMap {
    id: string;
    organizationId: string;
    crmTagName: string;
    chatwootLabel: string;
    whatsappLabel?: string;
    boardStageId?: string;
    color: string;
    syncToChatwoot: boolean;
    syncToWhatsapp: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LabelSyncLog {
    id: string;
    organizationId: string;
    dealId?: string;
    contactId?: string;
    conversationLinkId?: string;
    action: 'add_label' | 'remove_label' | 'sync_error';
    labelName: string;
    target: 'chatwoot' | 'whatsapp' | 'crm';
    success: boolean;
    errorMessage?: string;
    triggeredBy?: string;
    createdAt: string;
}

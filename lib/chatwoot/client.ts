import type {
    ChatwootConfig,
    ChatwootConversation,
    ChatwootMessage,
    ChatwootContact,
    ChatwootLabel,
    ConversationFilters,
    ConversationsResponse,
    MessagesResponse,
    SendMessagePayload,
    ChatwootContactPayload,
    ChatwootApiError,
} from './types';

/**
 * Chatwoot API Client
 *
 * A typed client for the Chatwoot API v1.
 * Uses fetch directly for simplicity and control.
 *
 * @example
 * ```typescript
 * const client = new ChatwootClient({
 *   baseUrl: 'https://chatwoot.example.com',
 *   token: 'your-api-token',
 *   accountId: 1,
 * });
 *
 * const conversations = await client.getConversations({ status: 'open' });
 * ```
 */
export class ChatwootClient {
    private baseUrl: string;
    private token: string;
    private accountId: number;

    constructor(config: ChatwootConfig) {
        // Remove trailing slash from baseUrl
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.token = config.token;
        this.accountId = config.accountId;
    }

    /**
     * Internal request method with error handling
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'api_access_token': this.token,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as ChatwootApiError;
            const errorMessage = errorData.error
                || errorData.errors?.join(', ')
                || errorData.description
                || `Chatwoot API error: ${response.status}`;
            throw new Error(errorMessage);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    // ========================================================================
    // Conversations
    // ========================================================================

    /**
     * List conversations with optional filters
     */
    async getConversations(
        filters?: ConversationFilters
    ): Promise<ChatwootConversation[]> {
        const params = new URLSearchParams();

        if (filters?.status) params.set('status', filters.status);
        if (filters?.inbox_id) params.set('inbox_id', filters.inbox_id.toString());
        if (filters?.assignee_type) params.set('assignee_type', filters.assignee_type);
        if (filters?.page) params.set('page', filters.page.toString());
        if (filters?.labels?.length) params.set('labels', filters.labels.join(','));

        const queryString = params.toString();
        const endpoint = `/conversations${queryString ? `?${queryString}` : ''}`;

        const response = await this.request<ConversationsResponse>(endpoint);
        return response.data.payload;
    }

    /**
     * Get a single conversation by ID
     */
    async getConversation(conversationId: number): Promise<ChatwootConversation> {
        return this.request<ChatwootConversation>(`/conversations/${conversationId}`);
    }

    /**
     * Update conversation status
     */
    async updateConversationStatus(
        conversationId: number,
        status: 'open' | 'resolved' | 'pending' | 'snoozed'
    ): Promise<ChatwootConversation> {
        return this.request<ChatwootConversation>(
            `/conversations/${conversationId}/status`,
            {
                method: 'POST',
                body: JSON.stringify({ status }),
            }
        );
    }

    /**
     * Toggle conversation status (open/resolved)
     */
    async toggleConversationStatus(
        conversationId: number
    ): Promise<ChatwootConversation> {
        return this.request<ChatwootConversation>(
            `/conversations/${conversationId}/toggle_status`,
            { method: 'POST' }
        );
    }

    /**
     * Assign conversation to an agent
     */
    async assignConversation(
        conversationId: number,
        assigneeId: number
    ): Promise<ChatwootConversation> {
        return this.request<ChatwootConversation>(
            `/conversations/${conversationId}/assignments`,
            {
                method: 'POST',
                body: JSON.stringify({ assignee_id: assigneeId }),
            }
        );
    }

    // ========================================================================
    // Messages
    // ========================================================================

    /**
     * Get messages for a conversation
     */
    async getMessages(
        conversationId: number,
        beforeId?: number
    ): Promise<ChatwootMessage[]> {
        const params = new URLSearchParams();
        if (beforeId) params.set('before', beforeId.toString());

        const queryString = params.toString();
        const endpoint = `/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`;

        const response = await this.request<MessagesResponse>(endpoint);
        return response.payload;
    }

    /**
     * Send a message to a conversation
     */
    async sendMessage(
        conversationId: number,
        payload: SendMessagePayload
    ): Promise<ChatwootMessage> {
        return this.request<ChatwootMessage>(
            `/conversations/${conversationId}/messages`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        );
    }

    /**
     * Send a text message (convenience method)
     */
    async sendTextMessage(
        conversationId: number,
        content: string,
        isPrivate = false
    ): Promise<ChatwootMessage> {
        return this.sendMessage(conversationId, {
            content,
            message_type: 'outgoing',
            private: isPrivate,
        });
    }

    /**
     * Delete a message
     */
    async deleteMessage(
        conversationId: number,
        messageId: number
    ): Promise<void> {
        await this.request<void>(
            `/conversations/${conversationId}/messages/${messageId}`,
            { method: 'DELETE' }
        );
    }

    // ========================================================================
    // Labels
    // ========================================================================

    /**
     * Get all labels for the account
     */
    async getLabels(): Promise<ChatwootLabel[]> {
        const response = await this.request<{ payload: ChatwootLabel[] }>('/labels');
        return response.payload;
    }

    /**
     * Get labels for a conversation
     */
    async getConversationLabels(conversationId: number): Promise<string[]> {
        const response = await this.request<{ payload: string[] }>(
            `/conversations/${conversationId}/labels`
        );
        return response.payload;
    }

    /**
     * Add labels to a conversation
     */
    async addLabels(conversationId: number, labels: string[]): Promise<string[]> {
        const response = await this.request<{ payload: string[] }>(
            `/conversations/${conversationId}/labels`,
            {
                method: 'POST',
                body: JSON.stringify({ labels }),
            }
        );
        return response.payload;
    }

    /**
     * Create a new label
     */
    async createLabel(
        title: string,
        description?: string,
        color?: string
    ): Promise<ChatwootLabel> {
        return this.request<ChatwootLabel>('/labels', {
            method: 'POST',
            body: JSON.stringify({
                title,
                description,
                color: color || '#6B7280',
                show_on_sidebar: true,
            }),
        });
    }

    // ========================================================================
    // Contacts
    // ========================================================================

    /**
     * Get a contact by ID
     */
    async getContact(contactId: number): Promise<ChatwootContact> {
        const response = await this.request<{ payload: ChatwootContact }>(
            `/contacts/${contactId}`
        );
        return response.payload;
    }

    /**
     * Search contacts by query
     */
    async searchContacts(query: string): Promise<ChatwootContact[]> {
        const response = await this.request<{ payload: ChatwootContact[] }>(
            `/contacts/search?q=${encodeURIComponent(query)}`
        );
        return response.payload;
    }

    /**
     * Create a new contact
     */
    async createContact(payload: ChatwootContactPayload): Promise<ChatwootContact> {
        const response = await this.request<{ payload: { contact: ChatwootContact } }>(
            '/contacts',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        );
        return response.payload.contact;
    }

    /**
     * Update a contact
     */
    async updateContact(
        contactId: number,
        payload: Partial<ChatwootContactPayload>
    ): Promise<ChatwootContact> {
        const response = await this.request<{ payload: ChatwootContact }>(
            `/contacts/${contactId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        );
        return response.payload;
    }

    /**
     * Get conversations for a contact
     */
    async getContactConversations(contactId: number): Promise<ChatwootConversation[]> {
        const response = await this.request<{ payload: ChatwootConversation[] }>(
            `/contacts/${contactId}/conversations`
        );
        return response.payload;
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Build the URL to open a conversation in Chatwoot
     */
    getConversationUrl(conversationId: number): string {
        return `${this.baseUrl}/app/accounts/${this.accountId}/conversations/${conversationId}`;
    }

    /**
     * Build the URL to open a contact in Chatwoot
     */
    getContactUrl(contactId: number): string {
        return `${this.baseUrl}/app/accounts/${this.accountId}/contacts/${contactId}`;
    }

    /**
     * Get the account ID
     */
    getAccountId(): number {
        return this.accountId;
    }

    /**
     * Get the base URL
     */
    getBaseUrl(): string {
        return this.baseUrl;
    }
}

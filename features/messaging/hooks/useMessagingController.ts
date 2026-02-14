'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useConversations, useUpdateConversation } from './useConversations';
import { useMessages, useSendMessage, useAddMessageToCache } from './useMessages';
import { useRealtimeSync } from '@/lib/realtime/useRealtimeSync';
import type { ConversationFilters, WhatsAppConversationView, WhatsAppMessage } from '../types/messaging';
import { adaptChatwootMessage } from '../utils/chatwootAdapters';
import type { ChatwootMessage, ChatwootContact } from '@/lib/chatwoot';

/**
 * Main controller hook for the messaging feature.
 *
 * This hook orchestrates conversations and messages from Chatwoot,
 * providing a unified interface for the MessagingPage and related components.
 *
 * Realtime updates are handled via:
 * - messaging_conversation_links: conversation status/metadata updates
 * - messaging_messages_cache: new incoming messages (when Phase 2 is complete)
 */
export function useMessagingController() {
    // State
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [filters, setFilters] = useState<ConversationFilters>({});
    const [draftMessage, setDraftMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Queries - now using Chatwoot via adapted hooks
    const {
        data: conversationsData,
        isLoading: isLoadingConversations,
        refetch: refetchConversations,
    } = useConversations({ filters });

    const {
        data: messagesData,
        isLoading: isLoadingMessages,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useMessages({ conversationId: selectedConversationId });

    // Mutations
    const updateConversation = useUpdateConversation();
    const sendMessageMutation = useSendMessage();
    const addMessageToCache = useAddMessageToCache();

    // Realtime subscriptions - using messaging_* tables (Chatwoot-backed)
    // Listen for conversation link updates (status changes, new links)
    useRealtimeSync('messaging_conversation_links', {
        onchange: (payload) => {
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                // Refetch conversations when links change
                refetchConversations();
            }
        },
    });

    // Listen for cached messages (Phase 2 - when messaging_messages_cache is implemented)
    // For now, this will be a no-op until the webhook populates the cache
    useRealtimeSync('messaging_messages_cache', {
        onchange: (payload) => {
            if (payload.eventType === 'INSERT' && payload.new) {
                // The payload contains the cached message data
                const cachedMessage = payload.new as {
                    chatwoot_message_id: number;
                    chatwoot_conversation_id: number;
                    content: string;
                    content_type: string;
                    message_type: string;
                    is_private: boolean;
                    attachments: unknown[];
                    sender_type: string;
                    sender_id: number;
                    sender_name: string;
                    created_at: string;
                };

                // Convert to Chatwoot message format, then adapt to WhatsApp format
                const chatwootMessage: ChatwootMessage = {
                    id: cachedMessage.chatwoot_message_id,
                    content: cachedMessage.content,
                    content_type: cachedMessage.content_type as 'text',
                    message_type: cachedMessage.message_type as 'incoming' | 'outgoing',
                    private: cachedMessage.is_private,
                    attachments: cachedMessage.attachments as [],
                    sender: cachedMessage.sender_name
                        ? {
                            id: cachedMessage.sender_id ?? 0,
                            name: cachedMessage.sender_name,
                            created_at: cachedMessage.created_at,
                          } as ChatwootContact
                        : undefined,
                    conversation_id: cachedMessage.chatwoot_conversation_id,
                    created_at: new Date(cachedMessage.created_at).getTime() / 1000,
                };

                const adaptedMessage = adaptChatwootMessage(chatwootMessage);
                addMessageToCache(adaptedMessage);
            }
        },
    });

    // Derived state
    const conversations = useMemo(
        () => conversationsData?.data || [],
        [conversationsData]
    );

    const messages = useMemo(() => {
        if (!messagesData?.pages) return [];
        return messagesData.pages.flatMap((page) => page.data);
    }, [messagesData]);

    const selectedConversation = useMemo(
        () => conversations.find((c) => c.id === selectedConversationId) || null,
        [conversations, selectedConversationId]
    );

    const unreadCount = useMemo(
        () => conversations.reduce((acc, c) => acc + c.unread_count, 0),
        [conversations]
    );

    // Handlers
    const handleSelectConversation = useCallback((id: string) => {
        setSelectedConversationId(id);
        setDraftMessage('');
    }, []);

    const handleSendMessage = useCallback(async () => {
        if (!selectedConversationId || !draftMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            await sendMessageMutation.mutateAsync({
                conversation_id: selectedConversationId,
                content: draftMessage.trim(),
            });
            setDraftMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    }, [selectedConversationId, draftMessage, isSending, sendMessageMutation]);

    const handleUpdateConversationStatus = useCallback(
        async (status: 'open' | 'pending' | 'resolved' | 'archived') => {
            if (!selectedConversationId) return;
            // Map 'archived' to 'resolved' for Chatwoot (Chatwoot doesn't have archived status)
            const chatwootStatus = status === 'archived' ? 'resolved' : status;
            await updateConversation.mutateAsync({
                id: selectedConversationId,
                updates: { status: chatwootStatus },
            });
        },
        [selectedConversationId, updateConversation]
    );

    const handleToggleAI = useCallback(async () => {
        if (!selectedConversation) return;
        // Note: ai_enabled is a CRM-specific concept, not directly supported by Chatwoot
        // This would need to be handled via custom_attributes or a local setting
        console.warn('AI toggle not yet implemented for Chatwoot integration');
    }, [selectedConversation]);

    const handleFilterChange = useCallback((newFilters: Partial<ConversationFilters>) => {
        setFilters((prev) => ({ ...prev, ...newFilters }));
    }, []);

    const handleLoadMoreMessages = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Auto-select first conversation
    useEffect(() => {
        if (!selectedConversationId && conversations.length > 0) {
            setSelectedConversationId(conversations[0].id);
        }
    }, [conversations, selectedConversationId]);

    return {
        // State
        selectedConversationId,
        selectedConversation,
        conversations,
        messages,
        filters,
        draftMessage,
        unreadCount,

        // Loading states
        isLoadingConversations,
        isLoadingMessages,
        isSending,
        isFetchingNextPage,
        hasNextPage,

        // Setters
        setDraftMessage,

        // Handlers
        handleSelectConversation,
        handleSendMessage,
        handleUpdateConversationStatus,
        handleToggleAI,
        handleFilterChange,
        handleLoadMoreMessages,
        refetchConversations,
    };
}

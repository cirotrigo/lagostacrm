'use client';

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { supabase } from '@/lib/supabase';
import { adaptChatwootMessage } from '../utils/chatwootAdapters';
import type { ChatwootMessage } from '@/lib/chatwoot';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseMessagingRealtimeOptions {
    /** Optional conversation ID to filter messages */
    conversationId?: number;
    /** Callback when a new message arrives */
    onNewMessage?: (message: ChatwootMessage) => void;
    /** Callback when conversation is updated */
    onConversationUpdate?: (conversationId: number) => void;
    /** Whether realtime is enabled */
    enabled?: boolean;
}

/**
 * Dedicated realtime hook for messaging
 *
 * Subscribes to:
 * - messaging_messages_cache: New incoming messages
 * - messaging_conversation_links: Conversation status updates
 *
 * @example
 * ```tsx
 * useMessagingRealtime({
 *   conversationId: selectedConversationId,
 *   onNewMessage: (message) => {
 *     // Play notification sound
 *     playNotificationSound();
 *   },
 * });
 * ```
 */
export function useMessagingRealtime(options: UseMessagingRealtimeOptions = {}) {
    const {
        conversationId,
        onNewMessage,
        onConversationUpdate,
        enabled = true,
    } = options;

    const queryClient = useQueryClient();

    // Handle new message from realtime
    const handleNewMessage = useCallback((payload: {
        new: {
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
    }) => {
        const cachedMessage = payload.new;

        // Skip if filtering by conversationId and this message is for a different conversation
        if (conversationId && cachedMessage.chatwoot_conversation_id !== conversationId) {
            return;
        }

        // Convert to Chatwoot message format
        const chatwootMessage: ChatwootMessage = {
            id: cachedMessage.chatwoot_message_id,
            content: cachedMessage.content,
            content_type: cachedMessage.content_type as 'text',
            message_type: cachedMessage.message_type as 'incoming' | 'outgoing',
            private: cachedMessage.is_private,
            attachments: cachedMessage.attachments as [],
            sender: cachedMessage.sender_name
                ? { id: cachedMessage.sender_id, name: cachedMessage.sender_name }
                : undefined,
            conversation_id: cachedMessage.chatwoot_conversation_id,
            created_at: new Date(cachedMessage.created_at).getTime() / 1000,
        };

        // Add to query cache
        const messageConvId = cachedMessage.chatwoot_conversation_id;
        queryClient.setQueryData(
            [...queryKeys.chatwoot.messages(messageConvId), 'infinite'],
            (old: { pages: Array<{ data: unknown[] }> } | undefined) => {
                if (!old) return old;

                const adaptedMessage = adaptChatwootMessage(chatwootMessage);

                // Check if message already exists
                const exists = old.pages.some((page) =>
                    page.data.some((m: { id: string }) => m.id === adaptedMessage.id)
                );
                if (exists) return old;

                return {
                    ...old,
                    pages: old.pages.map((page, index) =>
                        index === old.pages.length - 1
                            ? { ...page, data: [...page.data, adaptedMessage] }
                            : page
                    ),
                };
            }
        );

        // Call custom callback
        onNewMessage?.(chatwootMessage);

        // Also invalidate conversations to update last message preview
        queryClient.invalidateQueries({
            queryKey: queryKeys.chatwoot.conversations(),
        });
    }, [conversationId, onNewMessage, queryClient]);

    // Handle conversation link update
    const handleConversationUpdate = useCallback((payload: {
        new: {
            chatwoot_conversation_id: number;
            status: string;
            unread_count: number;
        };
    }) => {
        const updated = payload.new;

        // Invalidate relevant queries
        queryClient.invalidateQueries({
            queryKey: queryKeys.chatwoot.conversations(),
        });
        queryClient.invalidateQueries({
            queryKey: queryKeys.chatwoot.conversation(updated.chatwoot_conversation_id),
        });
        queryClient.invalidateQueries({
            queryKey: queryKeys.chatwoot.conversationLinks(),
        });

        // Call custom callback
        onConversationUpdate?.(updated.chatwoot_conversation_id);
    }, [onConversationUpdate, queryClient]);

    useEffect(() => {
        if (!enabled) return;

        const sb = supabase;
        if (!sb) {
            console.warn('[MessagingRealtime] Supabase client not available');
            return;
        }

        let messagesChannel: RealtimeChannel | null = null;
        let linksChannel: RealtimeChannel | null = null;

        // Subscribe to messaging_messages_cache
        messagesChannel = sb
            .channel('messaging-messages-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messaging_messages_cache',
                },
                handleNewMessage
            )
            .subscribe();

        // Subscribe to messaging_conversation_links
        linksChannel = sb
            .channel('messaging-links-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messaging_conversation_links',
                },
                handleConversationUpdate
            )
            .subscribe();

        return () => {
            if (messagesChannel) {
                sb.removeChannel(messagesChannel);
            }
            if (linksChannel) {
                sb.removeChannel(linksChannel);
            }
        };
    }, [enabled, handleNewMessage, handleConversationUpdate]);
}

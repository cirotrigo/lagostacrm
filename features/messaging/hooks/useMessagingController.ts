'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useConversations, useUpdateConversation } from './useConversations';
import { useMessages, useSendMessage, useAddMessageToCache } from './useMessages';
import { useRealtimeSync } from '@/lib/realtime/useRealtimeSync';
import type { ConversationFilters, WhatsAppConversationView, WhatsAppMessage } from '../types/messaging';

export function useMessagingController() {
  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ConversationFilters>({});
  const [draftMessage, setDraftMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Queries
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

  // Realtime subscriptions
  useRealtimeSync('whatsapp_messages', {
    onchange: (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        const message = payload.new as unknown as WhatsAppMessage;
        addMessageToCache(message);
      }
    },
  });

  useRealtimeSync('whatsapp_conversations', {
    onchange: (payload) => {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        refetchConversations();
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
      await updateConversation.mutateAsync({
        id: selectedConversationId,
        updates: { status },
      });
    },
    [selectedConversationId, updateConversation]
  );

  const handleToggleAI = useCallback(async () => {
    if (!selectedConversation) return;
    await updateConversation.mutateAsync({
      id: selectedConversation.id,
      updates: { ai_enabled: !selectedConversation.ai_enabled },
    });
  }, [selectedConversation, updateConversation]);

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

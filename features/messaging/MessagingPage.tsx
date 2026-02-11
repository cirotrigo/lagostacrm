'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useMessagingController } from './hooks/useMessagingController';
import { ConversationList } from './components/ConversationList';
import { ConversationHeader } from './components/ConversationHeader';
import { MessageThread } from './components/MessageThread';
import { MessageComposer } from './components/MessageComposer';

export const MessagingPage: React.FC = () => {
  const controller = useMessagingController();

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      {/* Sidebar - Conversation List */}
      <div className="w-80 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10">
        <ConversationList
          conversations={controller.conversations}
          selectedId={controller.selectedConversationId}
          onSelect={controller.handleSelectConversation}
          filters={controller.filters}
          onFilterChange={controller.handleFilterChange}
          isLoading={controller.isLoadingConversations}
          unreadCount={controller.unreadCount}
        />
      </div>

      {/* Main - Message Thread */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
        {controller.selectedConversation ? (
          <>
            <ConversationHeader
              conversation={controller.selectedConversation}
              onStatusChange={controller.handleUpdateConversationStatus}
              onToggleAI={controller.handleToggleAI}
            />

            <MessageThread
              messages={controller.messages}
              isLoading={controller.isLoadingMessages}
              isFetchingMore={controller.isFetchingNextPage}
              hasMore={controller.hasNextPage ?? false}
              onLoadMore={controller.handleLoadMoreMessages}
            />

            <MessageComposer
              value={controller.draftMessage}
              onChange={controller.setDraftMessage}
              onSend={controller.handleSendMessage}
              isSending={controller.isSending}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">Nenhuma conversa selecionada</h3>
            <p className="text-sm">Selecione uma conversa para começar a enviar mensagens</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagingPage;

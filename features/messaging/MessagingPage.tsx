'use client';

import React, { useState } from 'react';
import { MessageSquare, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useMessagingController } from './hooks/useMessagingController';
import { ConversationList } from './components/ConversationList';
import { ConversationHeader } from './components/ConversationHeader';
import { MessageThread } from './components/MessageThread';
import { MessageComposer } from './components/MessageComposer';
import { ContactInfoPanel } from './components/chat/ContactInfoPanel';

export const MessagingPage: React.FC = () => {
  const controller = useMessagingController();
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-surface-bg">
      {/* Col 1: Sidebar - Conversation List */}
      <div className="w-80 flex-shrink-0 bg-surface border-r border-[var(--color-border)]">
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

      {/* Col 2: Main - Message Thread */}
      <div className="flex-1 flex flex-col bg-surface min-w-0">
        {controller.selectedConversation ? (
          <>
            <ConversationHeader
              conversation={controller.selectedConversation}
              onStatusChange={controller.handleUpdateConversationStatus}
              onToggleAI={controller.handleToggleAI}
              isTogglingAI={controller.isTogglingAI}
            >
              {/* Toggle info panel button */}
              <button
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] rounded-lg transition-colors"
                title={showInfoPanel ? 'Ocultar informações' : 'Mostrar informações'}
              >
                {showInfoPanel ? (
                  <PanelRightClose className="w-5 h-5" />
                ) : (
                  <PanelRightOpen className="w-5 h-5" />
                )}
              </button>
            </ConversationHeader>

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
              onSendAudio={controller.handleSendAudio}
              isSending={controller.isSending || controller.isUploadingAttachment}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
            <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">Nenhuma conversa selecionada</h3>
            <p className="text-sm">Selecione uma conversa para começar a enviar mensagens</p>
          </div>
        )}
      </div>

      {/* Col 3: Info Panel (toggleable) */}
      {controller.selectedConversation && showInfoPanel && (
        <div className="w-80 flex-shrink-0 border-l border-[var(--color-border)] bg-surface">
          <ContactInfoPanel
            conversation={controller.selectedConversation}
            onClose={() => setShowInfoPanel(false)}
            onStatusChange={controller.handleUpdateConversationStatus}
          />
        </div>
      )}
    </div>
  );
};

export default MessagingPage;

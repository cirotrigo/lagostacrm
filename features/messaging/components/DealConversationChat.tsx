'use client';

import React, { useState, useMemo } from 'react';
import { MessageCircle, ExternalLink, Loader2, ChevronDown } from 'lucide-react';
import { useConversationLinks } from '../chatwoot/hooks/useConversationLinks';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';
import type { ConversationLink } from '@/lib/chatwoot';
import type { WhatsAppMessage } from '../types/messaging';

interface DealConversationChatProps {
    dealId: string;
    /** If true, shows the message composer for sending messages */
    allowSend?: boolean;
    /** Max height of the chat container */
    maxHeight?: string;
}

/**
 * DealConversationChat - Embedded chat history for a deal
 *
 * This component replaces ConversationTimeline in DealDetailModal,
 * showing the full message history instead of just metadata cards.
 *
 * Features:
 * - Fetches conversation links for the deal
 * - Shows message history using existing MessageThread/MessageBubble
 * - Supports multiple conversations with a selector
 * - Optional message composer for sending messages
 */
export const DealConversationChat: React.FC<DealConversationChatProps> = ({
    dealId,
    allowSend = true,
    maxHeight = '400px',
}) => {
    // Fetch conversation links for this deal
    const { data: links, isLoading: isLoadingLinks, error: linksError } = useConversationLinks({
        dealId,
    });

    // State for selected conversation when there are multiple
    const [selectedLinkIndex, setSelectedLinkIndex] = useState(0);
    const [showConversationSelector, setShowConversationSelector] = useState(false);

    // Get the selected conversation link
    const selectedLink = links?.[selectedLinkIndex] ?? null;
    const conversationId = selectedLink?.chatwootConversationId?.toString() ?? null;

    // Fetch messages for the selected conversation
    const {
        data: messagesData,
        isLoading: isLoadingMessages,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useMessages({
        conversationId,
        enabled: !!conversationId,
    });

    // Flatten messages from infinite query pages
    const messages: WhatsAppMessage[] = useMemo(() => {
        if (!messagesData?.pages) return [];
        return messagesData.pages.flatMap((page) => page.data);
    }, [messagesData?.pages]);

    // Send message mutation
    const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage();
    const [messageText, setMessageText] = useState('');

    const handleSend = async () => {
        if (!messageText.trim() || !conversationId) return;

        try {
            await sendMessage({
                conversation_id: conversationId,
                content: messageText.trim(),
            });
            setMessageText('');
        } catch (error) {
            console.error('[DealConversationChat] Failed to send message:', error);
        }
    };

    const handleLoadMore = () => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    // Loading state for conversation links
    if (isLoadingLinks) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Carregando conversas...
                </p>
            </div>
        );
    }

    // Error state
    if (linksError) {
        return (
            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">
                    Erro ao carregar conversas
                </p>
            </div>
        );
    }

    // No conversations linked
    if (!links?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <MessageCircle className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Nenhuma conversa vinculada
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    As conversas do WhatsApp aparecerão aqui quando vinculadas a este deal
                </p>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden"
            style={{ maxHeight }}
        >
            {/* Header with conversation selector (if multiple) */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Conversa
                    </span>

                    {/* Conversation selector for multiple conversations */}
                    {links.length > 1 && (
                        <div className="relative ml-2">
                            <button
                                onClick={() => setShowConversationSelector(!showConversationSelector)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <span>{selectedLinkIndex + 1} de {links.length}</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${showConversationSelector ? 'rotate-180' : ''}`} />
                            </button>

                            {showConversationSelector && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowConversationSelector(false)}
                                    />
                                    <div className="absolute left-0 top-full mt-1 z-20 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 py-1 overflow-hidden">
                                        {links.map((link, index) => (
                                            <ConversationOption
                                                key={link.id}
                                                link={link}
                                                index={index}
                                                isSelected={index === selectedLinkIndex}
                                                onSelect={() => {
                                                    setSelectedLinkIndex(index);
                                                    setShowConversationSelector(false);
                                                }}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Link to Chatwoot (secondary action) */}
                {selectedLink?.chatwootUrl && (
                    <a
                        href={selectedLink.chatwootUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        title="Abrir no Chatwoot"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Chatwoot</span>
                    </a>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <MessageThread
                    messages={messages}
                    isLoading={isLoadingMessages}
                    isFetchingMore={isFetchingNextPage}
                    hasMore={hasNextPage ?? false}
                    onLoadMore={handleLoadMore}
                />
            </div>

            {/* Message composer (optional) */}
            {allowSend && conversationId && (
                <MessageComposer
                    value={messageText}
                    onChange={setMessageText}
                    onSend={handleSend}
                    isSending={isSending}
                    disabled={!conversationId}
                />
            )}
        </div>
    );
};

// Helper component for conversation selector options
interface ConversationOptionProps {
    link: ConversationLink;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
}

const ConversationOption: React.FC<ConversationOptionProps> = ({
    link,
    index,
    isSelected,
    onSelect,
}) => {
    const statusColors: Record<string, string> = {
        open: 'bg-green-500',
        pending: 'bg-yellow-500',
        resolved: 'bg-slate-400',
    };

    return (
        <button
            onClick={onSelect}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
        >
            <span className={`w-2 h-2 rounded-full ${statusColors[link.status] || 'bg-slate-400'}`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium">#{index + 1}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {link.status === 'open' ? 'Aberta' : link.status === 'pending' ? 'Pendente' : 'Resolvida'}
                    </span>
                </div>
                {link.lastMessagePreview && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {link.lastMessagePreview}
                    </p>
                )}
            </div>
        </button>
    );
};

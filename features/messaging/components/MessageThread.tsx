'use client';

import React, { useRef, useEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, ArrowDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { WhatsAppMessage } from '../types/messaging';

interface MessageThreadProps {
  messages: WhatsAppMessage[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  isLoading,
  isFetchingMore,
  hasMore,
  onLoadMore,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  // Group messages by date
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; label: string; messages: WhatsAppMessage[] }[] = [];

    messages.forEach((message) => {
      const date = new Date(message.wpp_timestamp || message.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');

      let label = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
      if (isToday(date)) label = 'Hoje';
      else if (isYesterday(date)) label = 'Ontem';

      const existingGroup = groups.find((g) => g.date === dateKey);
      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({ date: dateKey, label, messages: [message] });
      }
    });

    return groups;
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Handle scroll for infinite loading and scroll button
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    // Load more when near top
    if (scrollTop < 100 && hasMore && !isFetchingMore) {
      onLoadMore();
    }

    // Show scroll button when not at bottom
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 200);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        <p>Nenhuma mensagem ainda</p>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto p-4"
      >
        {/* Load more indicator */}
        {isFetchingMore && (
          <div className="flex justify-center py-2 mb-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        )}

        {/* Messages grouped by date */}
        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 text-xs font-medium bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 rounded-full">
                {group.label}
              </span>
            </div>

            {/* Messages */}
            {group.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        ))}

        {/* Bottom anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      )}
    </div>
  );
};

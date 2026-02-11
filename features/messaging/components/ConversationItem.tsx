'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Bot, Check, CheckCheck } from 'lucide-react';
import type { WhatsAppConversationView } from '../types/messaging';

interface ConversationItemProps {
  conversation: WhatsAppConversationView;
  isSelected: boolean;
  onClick: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onClick,
}) => {
  const displayName =
    conversation.contact_name ||
    conversation.group_name ||
    conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
        locale: ptBR,
      })
    : '';

  const statusColors: Record<string, string> = {
    open: 'bg-green-500',
    pending: 'bg-yellow-500',
    resolved: 'bg-blue-500',
    archived: 'bg-slate-400',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-all ${
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
          : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {conversation.contact_avatar ? (
            <img
              src={conversation.contact_avatar}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-500" />
            </div>
          )}
          {/* Status dot */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
              statusColors[conversation.status] || statusColors.open
            }`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-900 dark:text-white truncate">
              {displayName}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
              {timeAgo}
            </span>
          </div>

          <div className="flex items-center gap-1 mt-0.5">
            {/* Direction indicator */}
            {conversation.last_message_direction === 'outbound' && (
              <CheckCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
            )}

            {/* AI indicator */}
            {conversation.ai_enabled && (
              <Bot className="w-3 h-3 text-purple-500 flex-shrink-0" />
            )}

            {/* Preview */}
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate flex-1">
              {conversation.last_message_preview || 'Sem mensagens'}
            </p>
          </div>

          {/* Unread badge & Deal info */}
          <div className="flex items-center justify-between mt-1">
            {conversation.deal_title && (
              <span className="text-xs text-slate-500 dark:text-slate-500 truncate max-w-[150px]">
                {conversation.deal_title}
              </span>
            )}
            {conversation.unread_count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-primary-500 rounded-full">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

'use client';

import React from 'react';
import {
  User,
  Bot,
  Headset,
  Loader2,
  MoreVertical,
  CheckCircle,
  Clock,
  Archive,
  ExternalLink,
} from 'lucide-react';
import type { WhatsAppConversationView, WhatsAppConversationStatus } from '../types/messaging';
import { MessagingSourceBadge, normalizeMessagingSource } from '@/components/ui/MessagingSourceBadge';

interface ConversationHeaderProps {
  conversation: WhatsAppConversationView;
  onStatusChange: (status: WhatsAppConversationStatus) => void;
  onToggleAI: () => void;
  isTogglingAI?: boolean;
  children?: React.ReactNode;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  onStatusChange,
  onToggleAI,
  isTogglingAI = false,
  children,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const displayName =
    conversation.contact_name ||
    conversation.group_name ||
    conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');

  const normalizedSource = normalizeMessagingSource(conversation.messaging_source);
  const remoteId = conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');
  const contactHandle =
    normalizedSource === 'INSTAGRAM'
      ? (remoteId || 'Sem identificador')
      : (conversation.contact_phone || remoteId || 'Sem telefone');

  const statusOptions: { value: WhatsAppConversationStatus; label: string; icon: React.ElementType }[] = [
    { value: 'open', label: 'Aberta', icon: CheckCircle },
    { value: 'pending', label: 'Pendente', icon: Clock },
    { value: 'resolved', label: 'Resolvida', icon: CheckCircle },
    { value: 'archived', label: 'Arquivada', icon: Archive },
  ];

  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
      {/* Contact info */}
      <div className="flex items-center gap-3">
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

        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-900 dark:text-white">{displayName}</h3>
            {conversation.ai_enabled && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                <Bot className="w-3 h-3" />
                IA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <MessagingSourceBadge source={conversation.messaging_source} size="xs" />
            <span>{contactHandle}</span>
            {conversation.deal_title && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <a
                  href={`/deals/${conversation.deal_id}`}
                  className="hover:text-primary-500 flex items-center gap-1"
                >
                  {conversation.deal_title}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Additional actions from parent */}
        {children}

        {/* AI Toggle */}
        <button
          onClick={onToggleAI}
          disabled={isTogglingAI}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all cursor-pointer select-none ${
            isTogglingAI
              ? 'opacity-60 cursor-wait'
              : conversation.ai_enabled
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:shadow-sm'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:shadow-sm'
          }`}
          title={conversation.ai_enabled ? 'Mudar para Atendimento Humano' : 'Devolver para IA'}
        >
          {isTogglingAI ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : conversation.ai_enabled ? (
            <Bot className="w-4 h-4" />
          ) : (
            <Headset className="w-4 h-4" />
          )}
          {isTogglingAI ? 'Alternando...' : conversation.ai_enabled ? 'IA Ativa' : 'Atendimento Humano'}
        </button>

        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 py-1 z-20">
                <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </div>
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onStatusChange(option.value);
                      setShowMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10 ${
                      conversation.status === option.value
                        ? 'text-primary-600 dark:text-primary-400 font-medium'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

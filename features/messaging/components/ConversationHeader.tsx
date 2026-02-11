'use client';

import React from 'react';
import {
  User,
  Phone,
  Bot,
  MoreVertical,
  CheckCircle,
  Clock,
  Archive,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import type { WhatsAppConversationView, WhatsAppConversationStatus } from '../types/messaging';

interface ConversationHeaderProps {
  conversation: WhatsAppConversationView;
  onStatusChange: (status: WhatsAppConversationStatus) => void;
  onToggleAI: () => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  onStatusChange,
  onToggleAI,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const displayName =
    conversation.contact_name ||
    conversation.group_name ||
    conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');

  const phoneNumber = conversation.contact_phone || conversation.remote_jid.replace('@c.us', '').replace('@s.whatsapp.net', '');

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
            <Phone className="w-3 h-3" />
            <span>+{phoneNumber}</span>
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
        {/* AI Toggle */}
        <button
          onClick={onToggleAI}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            conversation.ai_enabled
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
          }`}
          title={conversation.ai_enabled ? 'Desativar IA' : 'Ativar IA'}
        >
          <Bot className="w-4 h-4" />
          {conversation.ai_enabled ? 'IA Ativa' : 'IA Inativa'}
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

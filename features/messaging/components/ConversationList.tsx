'use client';

import React from 'react';
import { Search, Filter, Loader2, MessageSquare } from 'lucide-react';
import { ConversationItem } from './ConversationItem';
import type { WhatsAppConversationView, ConversationFilters } from '../types/messaging';

interface ConversationListProps {
  conversations: WhatsAppConversationView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: ConversationFilters;
  onFilterChange: (filters: Partial<ConversationFilters>) => void;
  isLoading: boolean;
  unreadCount: number;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
  isLoading,
  unreadCount,
}) => {
  const [searchValue, setSearchValue] = React.useState(filters.search || '');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFilterChange({ search: searchValue || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, filters.search, onFilterChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Conversas
            {unreadCount > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({unreadCount} não lidas)
              </span>
            )}
          </h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3">
          {(['all', 'open', 'pending', 'resolved'] as const).map((status) => (
            <button
              key={status}
              onClick={() => onFilterChange({ status: status === 'all' ? undefined : status })}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                (filters.status || 'all') === status
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {status === 'all' ? 'Todas' : status === 'open' ? 'Abertas' : status === 'pending' ? 'Pendentes' : 'Resolvidas'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              onClick={() => onSelect(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

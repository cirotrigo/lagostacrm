'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

export type ReservationFilter = {
  search: string;
  status: 'all' | 'confirmed' | 'canceled' | 'completed' | 'pending' | 'rejected';
};

interface Props {
  filter: ReservationFilter;
  onChange: (filter: ReservationFilter) => void;
  totalCount: number;
  filteredCount: number;
}

export const ReservationsFilters: React.FC<Props> = ({ filter, onChange, totalCount, filteredCount }) => {
  const hasFilters = filter.search.trim() !== '' || filter.status !== 'all';
  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 md:p-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={filter.search}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            placeholder="Buscar por nome do cliente ou descrição..."
            className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filter, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded text-slate-400"
              aria-label="Limpar busca"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex gap-1 bg-slate-100 dark:bg-white/5 rounded-xl p-0.5">
          {([
            { id: 'all', label: 'Todas' },
            { id: 'pending', label: 'Aguardando' },
            { id: 'confirmed', label: 'Confirmadas' },
            { id: 'canceled', label: 'Canceladas' },
            { id: 'rejected', label: 'Rejeitadas' },
            { id: 'completed', label: 'Concluídas' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...filter, status: id })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filter.status === id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => onChange({ search: '', status: 'all' })}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
          >
            Limpar
          </button>
        )}

        {/* Count */}
        <div className="md:ml-auto text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {hasFilters ? `${filteredCount} de ${totalCount}` : `${totalCount}`} reserva{totalCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

export function applyReservationFilter<T extends { contactName: string; status: string; activity: { description?: string } }>(
  list: T[],
  filter: ReservationFilter,
): T[] {
  const search = filter.search.trim().toLowerCase();
  return list.filter((r) => {
    if (filter.status !== 'all' && r.status !== filter.status) return false;
    if (search) {
      const haystack = `${r.contactName} ${r.activity.description ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

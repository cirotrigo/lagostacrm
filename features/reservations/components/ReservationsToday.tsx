'use client';

import React, { useMemo } from 'react';
import { Phone, Users as UsersIcon, Clock, RefreshCw, Sparkles } from 'lucide-react';
import type { Reservation } from '../hooks/useReservations';

interface Props {
  reservations: Reservation[];
  loading: boolean;
  onRefresh: () => void;
}

export const ReservationsToday: React.FC<Props> = ({ reservations, loading, onRefresh }) => {
  const sorted = useMemo(
    () => [...reservations].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [reservations],
  );

  const confirmed = sorted.filter((r) => r.status === 'confirmed');
  const canceled = sorted.filter((r) => r.status === 'canceled');

  return (
    <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <header className="flex items-center justify-between p-4 md:p-5 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">
            Reservas de hoje
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
            {confirmed.length === 0
              ? 'Nenhuma reserva confirmada pra hoje.'
              : `${confirmed.length} reserva${confirmed.length > 1 ? 's' : ''} confirmada${confirmed.length > 1 ? 's' : ''}`}
            {canceled.length > 0 && ` · ${canceled.length} cancelada${canceled.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 disabled:opacity-50 transition-colors"
          aria-label="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {sorted.length === 0 ? (
        <div className="p-8 text-center">
          <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sem reservas pra hoje. Ainda há tempo de receber novas pelo agente!
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {sorted.map((r) => (
            <ReservationRow key={r.id} reservation={r} />
          ))}
        </ul>
      )}
    </section>
  );
};

const ReservationRow: React.FC<{ reservation: Reservation }> = ({ reservation }) => {
  const isCanceled = reservation.status === 'canceled';
  const startStr = reservation.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endStr = reservation.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const phoneFromDescription = reservation.activity.description?.match(/(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/)?.[0];
  const waLink = phoneFromDescription
    ? `https://wa.me/55${phoneFromDescription.replace(/\D/g, '')}`
    : null;

  return (
    <li className={`p-4 md:p-5 flex items-start gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${isCanceled ? 'opacity-60' : ''}`}>
      <div className="flex flex-col items-center justify-center min-w-[64px] md:min-w-[72px] py-2 px-3 bg-slate-100 dark:bg-white/5 rounded-xl">
        <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white font-display tabular-nums">
          {startStr}
        </div>
        <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          até {endStr}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className={`font-semibold text-slate-900 dark:text-white ${isCanceled ? 'line-through' : ''}`}>
            {reservation.contactName}
          </h3>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full font-semibold">
            <UsersIcon className="h-3 w-3" />
            {reservation.partySize}
          </span>
          {isCanceled && (
            <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-full font-semibold uppercase">
              Cancelada
            </span>
          )}
        </div>
        {reservation.activity.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
            {reservation.activity.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {reservation.durationMinutes} min
          </span>
          {reservation.activity.dealTitle && (
            <span className="truncate">📎 {reservation.activity.dealTitle}</span>
          )}
        </div>
      </div>

      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-md shadow-green-500/30"
        >
          <Phone className="h-3 w-3" />
          WhatsApp
        </a>
      )}
    </li>
  );
};

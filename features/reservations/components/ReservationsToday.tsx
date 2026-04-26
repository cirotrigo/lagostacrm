'use client';

import React, { useMemo, useState } from 'react';
import { Phone, Users as UsersIcon, Clock, RefreshCw, Sparkles, X, CheckCircle2, Printer } from 'lucide-react';
import type { Reservation } from '../hooks/useReservations';
import { useReservationActions } from '../hooks/useReservationActions';

interface Props {
  reservations: Reservation[];
  loading: boolean;
  onRefresh: () => void;
}

export const ReservationsToday: React.FC<Props> = ({ reservations, loading, onRefresh }) => {
  const actions = useReservationActions();
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    const res = await actions.cancelReservation(id, 'Cancelado pela equipe');
    setConfirmCancel(null);
    if (res.ok) onRefresh();
  };

  const handleComplete = async (id: string) => {
    const res = await actions.markCompleted(id);
    if (res.ok) onRefresh();
  };

  const handlePrint = () => {
    window.print();
  };
  const sorted = useMemo(
    () => [...reservations].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [reservations],
  );

  const confirmed = sorted.filter((r) => r.status === 'confirmed');
  const canceled = sorted.filter((r) => r.status === 'canceled');

  return (
    <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <header className="flex items-center justify-between p-4 md:p-5 border-b border-slate-200 dark:border-white/10 print:border-b-2 print:border-black">
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
        <div className="flex gap-1 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
            aria-label="Imprimir lista"
            title="Imprimir / exportar PDF"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 disabled:opacity-50 transition-colors"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
            <ReservationRow
              key={r.id}
              reservation={r}
              pending={!!actions.pending[r.id]}
              confirmCancel={confirmCancel === r.id}
              onAskCancel={() => setConfirmCancel(r.id)}
              onCancelConfirm={() => handleCancel(r.id)}
              onCancelAbort={() => setConfirmCancel(null)}
              onMarkCompleted={() => handleComplete(r.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const ReservationRow: React.FC<{
  reservation: Reservation;
  pending: boolean;
  confirmCancel: boolean;
  onAskCancel: () => void;
  onCancelConfirm: () => void;
  onCancelAbort: () => void;
  onMarkCompleted: () => void;
}> = ({ reservation, pending, confirmCancel, onAskCancel, onCancelConfirm, onCancelAbort, onMarkCompleted }) => {
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

      <div className="flex flex-col gap-1.5 print:hidden">
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-md shadow-green-500/30"
          >
            <Phone className="h-3 w-3" />
            WhatsApp
          </a>
        )}
        {!isCanceled && reservation.status !== 'completed' && (
          <>
            {confirmCancel ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={onCancelConfirm}
                  disabled={pending}
                  className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold rounded transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={onCancelAbort}
                  disabled={pending}
                  className="px-2 py-1 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 text-[11px] font-semibold rounded transition-colors"
                >
                  Não
                </button>
              </div>
            ) : (
              <div className="hidden md:flex gap-1">
                <button
                  type="button"
                  onClick={onMarkCompleted}
                  disabled={pending}
                  title="Marcar como concluída"
                  className="p-1.5 bg-slate-100 dark:bg-white/10 hover:bg-green-100 dark:hover:bg-green-500/20 text-slate-600 dark:text-slate-300 hover:text-green-700 dark:hover:text-green-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onAskCancel}
                  disabled={pending}
                  title="Cancelar reserva"
                  className="p-1.5 bg-slate-100 dark:bg-white/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
};

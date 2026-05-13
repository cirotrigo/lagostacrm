'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, ChevronDown, ChevronRight, Users as UsersIcon, Clock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Reservation } from '../hooks/useReservations';
import { useReservationActions } from '../hooks/useReservationActions';

interface Props {
  reservations: Reservation[];
  onChange: () => void;
}

/**
 * Banner no topo da página de reservas mostrando reservas pendentes de aprovação
 * (qualquer data, não só hoje). Permite aprovar ou rejeitar inline.
 */
export const PendingApprovalsBanner: React.FC<Props> = ({ reservations, onChange }) => {
  const actions = useReservationActions();
  const [expanded, setExpanded] = useState(true);
  const [rejectFor, setRejectFor] = useState<Reservation | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      reservations
        .filter((r) => r.status === 'pending')
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [reservations],
  );

  if (pending.length === 0) return null;

  const handleApprove = async (id: string) => {
    setWarning(null);
    const res = await actions.approveReservation(id);
    if (!res.ok) {
      setWarning(`Falha ao aprovar: ${res.error ?? 'erro desconhecido'}`);
      return;
    }
    const notif = res.notification as { ok?: boolean; reason?: string; detail?: string } | undefined;
    if (notif && !notif.ok) {
      setWarning(
        `Reserva aprovada, mas cliente NÃO foi notificado (${notif.reason ?? 'erro'}${notif.detail ? ': ' + notif.detail : ''}). Avise manualmente.`,
      );
    }
    onChange();
  };

  const handleRejectSubmit = async () => {
    if (!rejectFor) return;
    if (rejectReason.trim().length < 3) {
      setRejectError('Informe o motivo (mínimo 3 caracteres).');
      return;
    }
    setRejectError(null);
    setWarning(null);
    const res = await actions.rejectReservation(rejectFor.id, rejectReason.trim());
    if (!res.ok) {
      setRejectError(res.error ?? 'Erro ao rejeitar.');
      return;
    }
    const notif = res.notification as { ok?: boolean; reason?: string; detail?: string } | undefined;
    if (notif && !notif.ok) {
      setWarning(
        `Reserva rejeitada, mas cliente NÃO foi notificado (${notif.reason ?? 'erro'}${notif.detail ? ': ' + notif.detail : ''}). Avise manualmente.`,
      );
    }
    setRejectFor(null);
    setRejectReason('');
    onChange();
  };

  return (
    <>
      <section className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-amber-100/50 dark:hover:bg-amber-500/20 transition-colors"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="p-2 bg-amber-200/70 dark:bg-amber-500/30 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-semibold text-amber-900 dark:text-amber-100">
                {pending.length} reserva{pending.length > 1 ? 's' : ''} aguardando aprovação
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300/80">
                A Sofia anotou e está aguardando sua decisão para notificar o cliente.
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          ) : (
            <ChevronRight className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          )}
        </button>

        {warning && expanded && (
          <div className="mx-4 mb-3 p-3 bg-white/60 dark:bg-black/20 border border-amber-300 dark:border-amber-500/40 rounded-lg flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">{warning}</div>
            <button
              type="button"
              onClick={() => setWarning(null)}
              className="p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-500/20"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {expanded && (
          <ul className="divide-y divide-amber-200/60 dark:divide-amber-500/20">
            {pending.map((r) => (
              <PendingRow
                key={r.id}
                reservation={r}
                disabled={!!actions.pending[r.id]}
                onApprove={() => handleApprove(r.id)}
                onReject={() => {
                  setRejectFor(r);
                  setRejectReason('');
                  setRejectError(null);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <Modal
        isOpen={!!rejectFor}
        onClose={() => {
          setRejectFor(null);
          setRejectReason('');
          setRejectError(null);
        }}
        title="Rejeitar reserva"
        size="md"
      >
        {rejectFor && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm">
              <div className="font-semibold text-slate-900 dark:text-white">{rejectFor.contactName}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {rejectFor.start.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                {rejectFor.partySize} pessoa{rejectFor.partySize === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                Motivo (será enviado ao cliente)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: estamos lotados nesse horário, podemos te oferecer 19h?"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white resize-none"
              />
            </div>
            {rejectError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-700 dark:text-red-300">
                {rejectError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setRejectFor(null);
                  setRejectReason('');
                  setRejectError(null);
                }}
                disabled={!!actions.pending[rejectFor.id]}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={!!actions.pending[rejectFor.id] || rejectReason.trim().length < 3}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
              >
                {actions.pending[rejectFor.id] ? 'Rejeitando…' : 'Rejeitar e notificar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

const PendingRow: React.FC<{
  reservation: Reservation;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}> = ({ reservation, disabled, onApprove, onReject }) => {
  const dateStr = reservation.start.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    weekday: 'short',
  });
  const timeStr = reservation.start.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className="px-4 py-3 flex items-center gap-3 hover:bg-amber-100/30 dark:hover:bg-amber-500/10 transition-colors">
      <div className="flex flex-col items-center justify-center min-w-[72px] py-1.5 px-2 bg-white dark:bg-black/20 rounded-lg border border-amber-200 dark:border-amber-500/30">
        <div className="text-sm font-bold text-amber-900 dark:text-amber-100 tabular-nums">{timeStr}</div>
        <div className="text-[10px] text-amber-700 dark:text-amber-300 tabular-nums uppercase">{dateStr}</div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 dark:text-white truncate">{reservation.contactName}</span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full font-semibold">
            <UsersIcon className="h-3 w-3" />
            {reservation.partySize}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 rounded-full">
            <Clock className="h-2.5 w-2.5" />
            {reservation.durationMinutes}min
          </span>
        </div>
        {reservation.activity.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
            {reservation.activity.description}
          </p>
        )}
      </div>

      <div className="flex gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled}
          title="Aprovar e notificar cliente"
          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Aprovar
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          title="Rejeitar reserva"
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Rejeitar
        </button>
      </div>
    </li>
  );
};

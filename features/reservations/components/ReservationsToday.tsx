'use client';

import React, { useMemo, useState } from 'react';
import { Phone, Users as UsersIcon, Clock, RefreshCw, Sparkles, X, CheckCircle2, Printer, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
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
  const [rejectFor, setRejectFor] = useState<Reservation | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actionWarning, setActionWarning] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    const res = await actions.cancelReservation(id, 'Cancelado pela equipe');
    setConfirmCancel(null);
    if (res.ok) onRefresh();
  };

  const handleComplete = async (id: string) => {
    const res = await actions.markCompleted(id);
    if (res.ok) onRefresh();
  };

  const handleApprove = async (id: string) => {
    setActionWarning(null);
    const res = await actions.approveReservation(id);
    if (!res.ok) {
      setActionWarning(`Falha ao aprovar: ${res.error ?? 'erro desconhecido'}`);
      return;
    }
    const notif = res.notification as { ok?: boolean; reason?: string; detail?: string } | undefined;
    if (notif && !notif.ok) {
      setActionWarning(
        `Reserva aprovada, mas cliente NÃO foi notificado (${notif.reason ?? 'erro'}${notif.detail ? ': ' + notif.detail : ''}). Avise manualmente.`,
      );
    }
    onRefresh();
  };

  const handleRejectSubmit = async () => {
    if (!rejectFor) return;
    if (rejectReason.trim().length < 3) {
      setRejectError('Informe o motivo (mínimo 3 caracteres).');
      return;
    }
    setRejectError(null);
    setActionWarning(null);
    const res = await actions.rejectReservation(rejectFor.id, rejectReason.trim());
    if (!res.ok) {
      setRejectError(res.error ?? 'Erro ao rejeitar.');
      return;
    }
    const notif = res.notification as { ok?: boolean; reason?: string; detail?: string } | undefined;
    if (notif && !notif.ok) {
      setActionWarning(
        `Reserva rejeitada, mas cliente NÃO foi notificado (${notif.reason ?? 'erro'}${notif.detail ? ': ' + notif.detail : ''}). Avise manualmente.`,
      );
    }
    setRejectFor(null);
    setRejectReason('');
    onRefresh();
  };

  const handlePrint = () => {
    window.print();
  };
  const sorted = useMemo(
    () => [...reservations].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [reservations],
  );

  const confirmed = sorted.filter((r) => r.status === 'confirmed');
  const pendingList = sorted.filter((r) => r.status === 'pending');
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
            {pendingList.length > 0 && ` · ${pendingList.length} aguardando aprovação`}
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

      {actionWarning && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">{actionWarning}</div>
          <button
            type="button"
            onClick={() => setActionWarning(null)}
            className="p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-500/20"
            aria-label="Fechar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
  onApprove: () => void;
  onReject: () => void;
}> = ({
  reservation,
  pending,
  confirmCancel,
  onAskCancel,
  onCancelConfirm,
  onCancelAbort,
  onMarkCompleted,
  onApprove,
  onReject,
}) => {
  const isCanceled = reservation.status === 'canceled';
  const isPending = reservation.status === 'pending';
  const isRejected = reservation.status === 'rejected';
  const startStr = reservation.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endStr = reservation.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const phoneFromDescription = reservation.activity.description?.match(/(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/)?.[0];
  const waLink = phoneFromDescription
    ? `https://wa.me/55${phoneFromDescription.replace(/\D/g, '')}`
    : null;

  const rowBg = isPending
    ? 'bg-amber-50/60 dark:bg-amber-500/10 border-l-4 border-amber-400 dark:border-amber-500/60'
    : '';

  return (
    <li
      className={`p-4 md:p-5 flex items-start gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
        isCanceled || isRejected ? 'opacity-60' : ''
      } ${rowBg}`}
    >
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
          <h3 className={`font-semibold text-slate-900 dark:text-white ${isCanceled || isRejected ? 'line-through' : ''}`}>
            {reservation.contactName}
          </h3>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full font-semibold">
            <UsersIcon className="h-3 w-3" />
            {reservation.partySize}
          </span>
          {isPending && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-200/70 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200 rounded-full font-semibold uppercase">
              <AlertTriangle className="h-3 w-3" />
              Aguardando
            </span>
          )}
          {isCanceled && (
            <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-full font-semibold uppercase">
              Cancelada
            </span>
          )}
          {isRejected && (
            <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-500/30 text-slate-700 dark:text-slate-300 rounded-full font-semibold uppercase">
              Rejeitada
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
        {isPending && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onApprove}
              disabled={pending}
              title="Aprovar e notificar cliente"
              className="px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aprovar
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={pending}
              title="Rejeitar reserva"
              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Rejeitar
            </button>
          </div>
        )}
        {!isPending && !isCanceled && !isRejected && reservation.status !== 'completed' && (
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

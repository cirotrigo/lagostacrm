'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, CheckCircle2, AlertTriangle, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase/client';
import type { SchedulingConfig } from '@/features/activities/hooks/useSchedulingConfig';

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  config?: SchedulingConfig | null;
}

type ContactLite = { id: string; name: string | null; phone: string | null; email: string | null };

type AvailabilityResponse = {
  available: boolean;
  reason?: string;
  blockedInfo?: { message?: string };
  availableCapacity?: number;
  bookedInWindow?: number;
  capacity?: number;
  durationMinutes?: number;
  dayWindow?: { lastBookableStart?: string };
  suggestions?: { start: string; availableCapacity: number }[];
  error?: string;
};

const REASON_LABELS: Record<string, string> = {
  feature_disabled: 'Sistema de reservas desabilitado nas configurações.',
  before_min_advance: 'Antecedência mínima não atendida.',
  after_max_advance: 'Reserva muito distante (acima do limite).',
  outside_reservation_hours: 'Fora do horário de aceitação de reservas.',
  outside_operating_hours: 'Reserva ultrapassaria o horário de funcionamento.',
  date_blocked: 'Data bloqueada na agenda.',
  capacity_full: 'Capacidade esgotada para esse horário.',
};

export const NewReservationModal: React.FC<NewReservationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  config,
}) => {
  const defaultDuration = config?.slotDurationMinutes ?? 120;

  // Form state
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<ContactLite[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactLite | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState<number>(2);
  const [duration, setDuration] = useState<number>(defaultDuration);
  const [observations, setObservations] = useState('');

  // Verify + submit state
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset everything when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setContactQuery('');
    setContactResults([]);
    setSelectedContact(null);
    setDate('');
    setTime('');
    setPartySize(2);
    setDuration(defaultDuration);
    setObservations('');
    setAvailability(null);
    setError(null);
    setChecking(false);
    setSubmitting(false);
  }, [isOpen, defaultDuration]);

  // Debounced contact search
  useEffect(() => {
    if (!isOpen) return;
    if (selectedContact) return;
    if (!contactQuery || contactQuery.trim().length < 2) {
      setContactResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const sb = supabase;
      if (!sb) return;
      setSearchingContacts(true);
      const q = contactQuery.trim();
      const { data } = await sb
        .from('contacts')
        .select('id, name, phone, email')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      setContactResults((data ?? []) as ContactLite[]);
      setSearchingContacts(false);
    }, 300);
    return () => clearTimeout(t);
  }, [contactQuery, isOpen, selectedContact]);

  // Invalidate verification when inputs change
  useEffect(() => {
    setAvailability(null);
  }, [date, time, partySize, duration]);

  const startDate = useMemo<Date | null>(() => {
    if (!date || !time) return null;
    // Trata como horário local de São Paulo (BR é UTC-3 sem DST desde 2019)
    const d = new Date(`${date}T${time}:00-03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [date, time]);

  const formInvalid =
    !selectedContact || !startDate || !partySize || partySize < 1 || !duration || duration < 15;

  async function verifyAvailability() {
    setError(null);
    setAvailability(null);
    if (!startDate) {
      setError('Informe data e hora.');
      return;
    }
    if (!partySize || partySize < 1) {
      setError('Informe o número de pessoas.');
      return;
    }
    setChecking(true);
    try {
      const res = await fetch('/api/reservations/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          start: startDate.toISOString(),
          party_size: partySize,
          duration_minutes: duration,
        }),
      });
      const json: AvailabilityResponse = await res.json();
      if (!res.ok) {
        setError(json.error || `Falha ao verificar disponibilidade (HTTP ${res.status}).`);
        return;
      }
      setAvailability(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede ao verificar disponibilidade.');
    } finally {
      setChecking(false);
    }
  }

  function pickSuggestion(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    // Quebra em date YYYY-MM-DD e time HH:MM (no fuso local de SP)
    const tzOffsetMin = 3 * 60; // BR fixed UTC-3
    const local = new Date(d.getTime() - tzOffsetMin * 60_000);
    const yyyy = local.getUTCFullYear();
    const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(local.getUTCDate()).padStart(2, '0');
    const hh = String(local.getUTCHours()).padStart(2, '0');
    const mi = String(local.getUTCMinutes()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
    setTime(`${hh}:${mi}`);
    setAvailability(null);
  }

  async function submitReservation() {
    if (!selectedContact || !startDate) return;
    if (!availability?.available) {
      setError('Verifique disponibilidade antes de confirmar.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const sb = supabase;
      if (!sb) {
        setError('Supabase não configurado.');
        return;
      }
      const { data: userData } = await sb.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setError('Sessão expirada.');
        return;
      }
      const { data: profile, error: profileErr } = await sb
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();
      if (profileErr || !profile?.organization_id) {
        setError('Organização não encontrada no perfil.');
        return;
      }

      const phone = selectedContact.phone || '';
      const email = selectedContact.email || '';
      const displayName = selectedContact.name || 'Cliente';
      const niceDate = `${date.split('-').reverse().join('/')} às ${time}`;
      const title = `Reserva ${partySize} pessoa${partySize === 1 ? '' : 's'} - ${displayName}`;
      const descParts = [
        `Nome: ${displayName}`,
        phone ? `Telefone: ${phone}` : null,
        email ? `Email: ${email}` : null,
        `Reserva para ${partySize} pessoa${partySize === 1 ? '' : 's'} em ${niceDate}.`,
        observations.trim() ? `Observações: ${observations.trim()}` : null,
      ].filter(Boolean);

      const { error: insertErr } = await sb.from('activities').insert({
        title,
        description: descParts.join(' | '),
        type: 'meeting',
        date: startDate.toISOString(),
        completed: false,
        contact_id: selectedContact.id,
        organization_id: profile.organization_id,
        metadata: {
          status: 'confirmed',
          party_size: partySize,
          duration_minutes: duration,
          source: 'manual',
        },
      });
      if (insertErr) {
        setError(insertErr.message);
        return;
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar reserva.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova reserva manual" size="xl">
      <div className="space-y-5">
        {/* Contact picker */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
            Contato
          </label>
          {selectedContact ? (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 rounded-lg">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white truncate">
                  {selectedContact.name || 'Sem nome'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {[selectedContact.phone, selectedContact.email].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedContact(null);
                  setContactQuery('');
                  setContactResults([]);
                }}
                className="p-1.5 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 text-slate-500"
                aria-label="Remover contato selecionado"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nome, telefone ou email…"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
              />
              {(searchingContacts || contactResults.length > 0) && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchingContacts && (
                    <div className="px-3 py-2 text-xs text-slate-500">Buscando…</div>
                  )}
                  {!searchingContacts && contactResults.length === 0 && contactQuery.length >= 2 && (
                    <div className="px-3 py-2 text-xs text-slate-500">Nenhum contato encontrado.</div>
                  )}
                  {contactResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedContact(c);
                        setContactResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 last:border-b-0"
                    >
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {c.name || 'Sem nome'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date / Time / Party / Duration */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Hora
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Pessoas
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Duração (min)
            </label>
            <input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </div>
        </div>

        {/* Observations */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
            Observações (opcional)
          </label>
          <textarea
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Aniversário, preferência de mesa, restrições alimentares…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:text-white resize-none"
          />
        </div>

        {/* Verify button + availability result */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={verifyAvailability}
            disabled={checking || !startDate || !partySize}
            className="self-start px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-white/10 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            {checking ? 'Verificando…' : availability ? 'Verificar novamente' : 'Verificar disponibilidade'}
          </button>

          {availability?.available && (
            <div className="flex items-start gap-2.5 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700 dark:text-green-300">
                <div className="font-semibold">Horário disponível.</div>
                <div className="text-xs mt-0.5">
                  Capacidade livre: {availability.availableCapacity ?? '—'} /{' '}
                  {availability.capacity ?? '—'} (ocupado: {availability.bookedInWindow ?? 0}).
                </div>
              </div>
            </div>
          )}

          {availability && !availability.available && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300 min-w-0 flex-1">
                <div className="font-semibold">
                  {availability.blockedInfo?.message ||
                    REASON_LABELS[availability.reason ?? ''] ||
                    'Horário indisponível.'}
                </div>
                {availability.dayWindow?.lastBookableStart && (
                  <div className="text-xs mt-0.5">
                    Último horário possível no dia: {availability.dayWindow.lastBookableStart}.
                  </div>
                )}
                {availability.suggestions && availability.suggestions.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold mb-1">Sugestões próximas:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {availability.suggestions.map((s) => {
                        const d = new Date(s.start);
                        const label = d.toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <button
                            key={s.start}
                            type="button"
                            onClick={() => pickSuggestion(s.start)}
                            className="px-2 py-1 bg-white dark:bg-white/10 border border-amber-300 dark:border-amber-500/30 rounded text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20"
                          >
                            {label} ({s.availableCapacity} livres)
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submitReservation}
            disabled={submitting || formInvalid || !availability?.available}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-primary-600/20 flex items-center gap-2"
          >
            <CalendarPlus className="h-4 w-4" />
            {submitting ? 'Criando…' : 'Confirmar reserva'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

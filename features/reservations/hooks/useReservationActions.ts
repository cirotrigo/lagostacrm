'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useReservationActions() {
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const setPendingFor = (id: string, val: boolean) =>
    setPending((p) => ({ ...p, [id]: val }));

  /**
   * Cancela uma reserva: marca activity.metadata.status='canceled' + completed=true.
   * Usa Supabase direto (RLS aplica). Não move o deal — equipe move manualmente se quiser.
   */
  async function cancelReservation(activityId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
    setPendingFor(activityId, true);
    try {
      const sb = supabase;
      if (!sb) return { ok: false, error: 'Supabase não configurado' };
      const { data: existing, error: fetchErr } = await sb
        .from('activities')
        .select('metadata')
        .eq('id', activityId)
        .maybeSingle();
      if (fetchErr) return { ok: false, error: fetchErr.message };
      const nextMeta = {
        ...((existing as any)?.metadata ?? {}),
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        cancel_reason: reason ?? 'Cancelado pela equipe',
      };
      const { error } = await sb
        .from('activities')
        .update({ metadata: nextMeta, completed: true })
        .eq('id', activityId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } finally {
      setPendingFor(activityId, false);
    }
  }

  /**
   * Remarca uma reserva pra novo horário. Verifica disponibilidade primeiro.
   * Se disponível → UPDATE activity.date.
   * Se não → retorna { ok: false, reason, suggestions }.
   */
  async function rescheduleReservation(
    activityId: string,
    newStart: Date,
    partySize: number,
    durationMinutes: number,
  ): Promise<{
    ok: boolean;
    error?: string;
    reason?: string;
    suggestions?: { start: string; availableCapacity: number }[];
    dayWindow?: { lastBookableStart?: string };
  }> {
    setPendingFor(activityId, true);
    try {
      // Check availability
      const checkRes = await fetch('/api/reservations/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          start: newStart.toISOString(),
          party_size: partySize,
          duration_minutes: durationMinutes,
        }),
      });
      if (!checkRes.ok) {
        return { ok: false, error: 'Falha ao verificar disponibilidade' };
      }
      const result = await checkRes.json();
      if (!result.available) {
        return {
          ok: false,
          reason: result.reason,
          suggestions: result.suggestions,
          dayWindow: result.dayWindow,
        };
      }
      // Apply update
      const sb = supabase;
      if (!sb) return { ok: false, error: 'Supabase não configurado' };
      const { error } = await sb
        .from('activities')
        .update({ date: newStart.toISOString() })
        .eq('id', activityId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erro' };
    } finally {
      setPendingFor(activityId, false);
    }
  }

  /**
   * Aprova uma reserva pendente (status='pending' → 'confirmed') e dispara
   * notificação ao cliente via Chatwoot.
   */
  async function approveReservation(
    activityId: string,
  ): Promise<{ ok: boolean; error?: string; notification?: unknown }> {
    setPendingFor(activityId, true);
    try {
      const res = await fetch(`/api/reservations/${activityId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body?.error || `HTTP ${res.status}` };
      return { ok: true, notification: body?.notification };
    } finally {
      setPendingFor(activityId, false);
    }
  }

  /**
   * Rejeita uma reserva pendente (status='pending' → 'rejected') com motivo e
   * dispara notificação ao cliente via Chatwoot.
   */
  async function rejectReservation(
    activityId: string,
    reason: string,
  ): Promise<{ ok: boolean; error?: string; notification?: unknown }> {
    setPendingFor(activityId, true);
    try {
      const res = await fetch(`/api/reservations/${activityId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body?.error || `HTTP ${res.status}` };
      return { ok: true, notification: body?.notification };
    } finally {
      setPendingFor(activityId, false);
    }
  }

  /** Marca como concluída (cliente compareceu). */
  async function markCompleted(activityId: string): Promise<{ ok: boolean; error?: string }> {
    setPendingFor(activityId, true);
    try {
      const sb = supabase;
      if (!sb) return { ok: false, error: 'Supabase não configurado' };
      const { data: existing, error: fetchErr } = await sb
        .from('activities')
        .select('metadata')
        .eq('id', activityId)
        .maybeSingle();
      if (fetchErr) return { ok: false, error: fetchErr.message };
      const nextMeta = {
        ...((existing as any)?.metadata ?? {}),
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      const { error } = await sb
        .from('activities')
        .update({ metadata: nextMeta, completed: true })
        .eq('id', activityId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } finally {
      setPendingFor(activityId, false);
    }
  }

  return {
    pending,
    cancelReservation,
    markCompleted,
    rescheduleReservation,
    approveReservation,
    rejectReservation,
  };
}

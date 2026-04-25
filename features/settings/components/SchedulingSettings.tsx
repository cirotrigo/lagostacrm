'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, Loader2, Check, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: 'monday', label: 'Segunda' },
  { id: 'tuesday', label: 'Terça' },
  { id: 'wednesday', label: 'Quarta' },
  { id: 'thursday', label: 'Quinta' },
  { id: 'friday', label: 'Sexta' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
];

type Interval = { start: string; end: string };
type DayHours = { open: boolean; intervals: Interval[] };
type OperatingHours = Partial<Record<Weekday, DayHours>>;
type BlockedDate = { date: string; reason: string; mode: 'first_come' | 'closed'; message?: string };
type Area = { id: string; name: string; capacity: number };

type SchedulingState = {
  enabled: boolean;
  maxAdvanceDays: number;
  minAdvanceMinutes: number;
  defaultCapacity: number;
  slotDurationMinutes: number;
  slotStepMinutes: number;
  operatingHours: OperatingHours;
  blockedDates: BlockedDate[];
  areas: Area[];
};

const DEFAULT_STATE: SchedulingState = {
  enabled: false,
  maxAdvanceDays: 30,
  minAdvanceMinutes: 90,
  defaultCapacity: 0,
  slotDurationMinutes: 120,
  slotStepMinutes: 30,
  operatingHours: {},
  blockedDates: [],
  areas: [],
};

export const SchedulingSettings: React.FC = () => {
  const [state, setState] = useState<SchedulingState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areasOpen, setAreasOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/scheduling', { credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar configurações');
      const data = await res.json();
      setState({
        enabled: !!data.enabled,
        maxAdvanceDays: data.maxAdvanceDays ?? 30,
        minAdvanceMinutes: data.minAdvanceMinutes ?? 90,
        defaultCapacity: data.defaultCapacity ?? 0,
        slotDurationMinutes: data.slotDurationMinutes ?? 120,
        slotStepMinutes: data.slotStepMinutes ?? 30,
        operatingHours: data.operatingHours ?? {},
        blockedDates: data.blockedDates ?? [],
        areas: data.areas ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Validações leves
      if (state.defaultCapacity < 0) throw new Error('Capacidade não pode ser negativa');
      if (state.maxAdvanceDays < 1) throw new Error('Antecedência máxima deve ser ao menos 1 dia');
      if (state.minAdvanceMinutes < 0) throw new Error('Antecedência mínima inválida');
      for (const d of state.blockedDates) {
        if (!d.date || !d.reason) throw new Error('Cada data bloqueada precisa ter data e motivo');
      }
      for (const a of state.areas) {
        if (!a.id || !a.name) throw new Error('Cada área precisa ter id e nome');
        if (a.capacity < 0) throw new Error('Capacidade da área não pode ser negativa');
      }

      const res = await fetch('/api/settings/scheduling', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Falha ao salvar');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day: Weekday, partial: Partial<DayHours>) => {
    setState((s) => ({
      ...s,
      operatingHours: {
        ...s.operatingHours,
        [day]: {
          open: s.operatingHours[day]?.open ?? false,
          intervals: s.operatingHours[day]?.intervals ?? [],
          ...partial,
        },
      },
    }));
  };

  const addInterval = (day: Weekday) => {
    const current = state.operatingHours[day];
    updateDay(day, {
      open: true,
      intervals: [...(current?.intervals ?? []), { start: '11:00', end: '22:00' }],
    });
  };

  const removeInterval = (day: Weekday, idx: number) => {
    const current = state.operatingHours[day];
    if (!current) return;
    updateDay(day, {
      intervals: current.intervals.filter((_, i) => i !== idx),
    });
  };

  const updateInterval = (day: Weekday, idx: number, field: 'start' | 'end', value: string) => {
    const current = state.operatingHours[day];
    if (!current) return;
    updateDay(day, {
      intervals: current.intervals.map((iv, i) => (i === idx ? { ...iv, [field]: value } : iv)),
    });
  };

  const addBlockedDate = () => {
    setState((s) => ({
      ...s,
      blockedDates: [...s.blockedDates, { date: '', reason: '', mode: 'first_come', message: '' }],
    }));
  };

  const updateBlockedDate = (idx: number, partial: Partial<BlockedDate>) => {
    setState((s) => ({
      ...s,
      blockedDates: s.blockedDates.map((b, i) => (i === idx ? { ...b, ...partial } : b)),
    }));
  };

  const removeBlockedDate = (idx: number) => {
    setState((s) => ({ ...s, blockedDates: s.blockedDates.filter((_, i) => i !== idx) }));
  };

  const addArea = () => {
    setState((s) => ({
      ...s,
      areas: [...s.areas, { id: `area${s.areas.length + 1}`, name: '', capacity: 0 }],
    }));
  };

  const updateArea = (idx: number, partial: Partial<Area>) => {
    setState((s) => ({
      ...s,
      areas: s.areas.map((a, i) => (i === idx ? { ...a, ...partial } : a)),
    }));
  };

  const removeArea = (idx: number) => {
    setState((s) => ({ ...s, areas: s.areas.filter((_, i) => i !== idx) }));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-primary-500/10 p-2 rounded-lg">
            <Calendar className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Agendamento de Reservas</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configurações usadas pelo agente de IA ao registrar reservas (capacidade, horários e datas bloqueadas).
            </p>
          </div>
        </div>

        {/* Toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => setState((s) => ({ ...s, enabled: e.target.checked }))}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            Habilitar agendamento de reservas neste tenant
          </span>
        </label>
      </div>

      {/* Limites e capacidade */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Limites e capacidade</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumberField
            label="Capacidade total (sem áreas)"
            value={state.defaultCapacity}
            onChange={(v) => setState((s) => ({ ...s, defaultCapacity: v }))}
            help="Pessoas que cabem simultaneamente. Ignorado se houver áreas configuradas."
            min={0}
          />
          <NumberField
            label="Antecedência máxima (dias)"
            value={state.maxAdvanceDays}
            onChange={(v) => setState((s) => ({ ...s, maxAdvanceDays: v }))}
            help="Quantos dias no futuro o cliente pode reservar."
            min={1}
            max={365}
          />
          <NumberField
            label="Antecedência mínima (minutos)"
            value={state.minAdvanceMinutes}
            onChange={(v) => setState((s) => ({ ...s, minAdvanceMinutes: v }))}
            help="Tempo mínimo entre agora e a hora da reserva."
            min={0}
          />
          <NumberField
            label="Duração da reserva (minutos)"
            value={state.slotDurationMinutes}
            onChange={(v) => setState((s) => ({ ...s, slotDurationMinutes: v }))}
            help="Quanto tempo cada mesa fica reservada."
            min={15}
            max={720}
          />
          <NumberField
            label="Granularidade dos slots (minutos)"
            value={state.slotStepMinutes}
            onChange={(v) => setState((s) => ({ ...s, slotStepMinutes: v }))}
            help="30 = horários como 19h, 19h30, 20h..."
            min={5}
            max={120}
          />
        </div>
      </div>

      {/* Horário de funcionamento */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Horário de funcionamento</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Reservas só são aceitas dentro destes intervalos.
        </p>
        <div className="space-y-3">
          {WEEKDAYS.map((day) => {
            const hours = state.operatingHours[day.id] ?? { open: false, intervals: [] };
            return (
              <div
                key={day.id}
                className="flex items-start gap-4 py-3 border-b border-slate-100 dark:border-white/5 last:border-b-0"
              >
                <label className="flex items-center gap-2 min-w-[120px] cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={hours.open}
                    onChange={(e) => updateDay(day.id, { open: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{day.label}</span>
                </label>
                <div className="flex-1 space-y-2">
                  {!hours.open && (
                    <span className="text-sm text-slate-400">Fechado</span>
                  )}
                  {hours.open && hours.intervals.length === 0 && (
                    <span className="text-sm text-slate-400">Sem intervalos — adicione um abaixo</span>
                  )}
                  {hours.open &&
                    hours.intervals.map((iv, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={iv.start}
                          onChange={(e) => updateInterval(day.id, idx, 'start', e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                        />
                        <span className="text-slate-400">até</span>
                        <input
                          type="time"
                          value={iv.end}
                          onChange={(e) => updateInterval(day.id, idx, 'end', e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeInterval(day.id, idx)}
                          className="text-red-500 hover:text-red-600 p-1"
                          aria-label="Remover intervalo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  {hours.open && (
                    <button
                      type="button"
                      onClick={() => addInterval(day.id)}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Adicionar intervalo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Datas bloqueadas */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">Datas bloqueadas</h4>
          <button
            type="button"
            onClick={addBlockedDate}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Datas em que reservas não são aceitas (ex: Dia das Mães, feriados especiais). Cabernet explica ao cliente o motivo e o modo.
        </p>
        {state.blockedDates.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma data bloqueada.</p>
        )}
        <div className="space-y-3">
          {state.blockedDates.map((b, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start p-3 rounded-xl bg-slate-50 dark:bg-black/20">
              <input
                type="date"
                value={b.date}
                onChange={(e) => updateBlockedDate(idx, { date: e.target.value })}
                className="md:col-span-2 px-3 py-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Motivo (ex: Dia das Mães)"
                value={b.reason}
                onChange={(e) => updateBlockedDate(idx, { reason: e.target.value })}
                className="md:col-span-3 px-3 py-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
              />
              <select
                value={b.mode}
                onChange={(e) => updateBlockedDate(idx, { mode: e.target.value as 'first_come' | 'closed' })}
                className="md:col-span-2 px-3 py-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
              >
                <option value="first_come">Por ordem de chegada</option>
                <option value="closed">Fechado</option>
              </select>
              <input
                type="text"
                placeholder="Mensagem para o cliente (opcional)"
                value={b.message ?? ''}
                onChange={(e) => updateBlockedDate(idx, { message: e.target.value })}
                className="md:col-span-4 px-3 py-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => removeBlockedDate(idx)}
                className="md:col-span-1 text-red-500 hover:text-red-600 p-2 self-center"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Áreas (avançado) */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
        <button
          type="button"
          onClick={() => setAreasOpen((v) => !v)}
          className="w-full flex items-center justify-between p-6 text-left"
        >
          <div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">Áreas (avançado)</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Defina capacidades por área (terraço, salão). Vazio usa a capacidade total acima.
            </p>
          </div>
          {areasOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        {areasOpen && (
          <div className="px-6 pb-6 space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addArea}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Adicionar área
              </button>
            </div>
            {state.areas.length === 0 && (
              <p className="text-sm text-slate-400">Nenhuma área. Capacidade vai usar &quot;Capacidade total&quot;.</p>
            )}
            {state.areas.map((a, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 rounded-xl bg-slate-50 dark:bg-black/20">
                <input
                  type="text"
                  placeholder="ID (ex: salao)"
                  value={a.id}
                  onChange={(e) => updateArea(idx, { id: e.target.value })}
                  className="md:col-span-3 px-3 py-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Nome (ex: Salão)"
                  value={a.name}
                  onChange={(e) => updateArea(idx, { name: e.target.value })}
                  className="md:col-span-5 px-3 py-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                />
                <input
                  type="number"
                  placeholder="Capacidade"
                  min={0}
                  value={a.capacity}
                  onChange={(e) => updateArea(idx, { capacity: Number(e.target.value) })}
                  className="md:col-span-3 px-3 py-2 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeArea(idx)}
                  className="md:col-span-1 text-red-500 hover:text-red-600 p-2 justify-self-center"
                  aria-label="Remover área"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-lg">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </button>
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check className="h-4 w-4" /> Salvo
          </span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
};

const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
  min?: number;
  max?: number;
}> = ({ label, value, onChange, help, min, max }) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-1 w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white"
    />
    {help && <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">{help}</span>}
  </label>
);

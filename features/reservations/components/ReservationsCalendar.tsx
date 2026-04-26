'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users as UsersIcon, GripVertical } from 'lucide-react';
import type { Reservation } from '../hooks/useReservations';
import {
  findBlockedDate,
  getWeekHourRange,
  isDayClosed,
  isSlotOpen,
  type SchedulingConfig,
} from '@/features/activities/hooks/useSchedulingConfig';
import { useReservationActions } from '../hooks/useReservationActions';
import { useToast } from '@/context/ToastContext';

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PIXELS_PER_HOUR = 64;
const SLOT_MINUTES = 30;

interface Props {
  reservations: Reservation[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  config: SchedulingConfig | null;
  onChange?: () => void;
}

type View = 'week' | 'day';

type DragState = {
  reservationId: string;
  partySize: number;
  durationMinutes: number;
  hoverDate?: Date | null;
  hoverMinute?: number | null;
} | null;

export const ReservationsCalendar: React.FC<Props> = ({
  reservations,
  currentDate,
  setCurrentDate,
  config,
  onChange,
}) => {
  const [view, setView] = useState<View>('week');
  const [drag, setDrag] = useState<DragState>(null);
  const actions = useReservationActions();
  const { addToast } = useToast();

  const onDragStart = (r: Reservation, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', r.id);
    setDrag({ reservationId: r.id, partySize: r.partySize, durationMinutes: r.durationMinutes });
  };

  const onDragEnd = () => setDrag(null);

  const onDragOverColumn = (date: Date, e: React.DragEvent, startHour: number) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minutesFromStart = Math.max(0, Math.round((offsetY / PIXELS_PER_HOUR) * 60 / SLOT_MINUTES) * SLOT_MINUTES);
    setDrag((prev) => prev ? { ...prev, hoverDate: date, hoverMinute: startHour * 60 + minutesFromStart } : prev);
  };

  const onDropColumn = async (date: Date, e: React.DragEvent, startHour: number) => {
    if (!drag) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minutesFromStart = Math.max(0, Math.round((offsetY / PIXELS_PER_HOUR) * 60 / SLOT_MINUTES) * SLOT_MINUTES);
    const totalMin = startHour * 60 + minutesFromStart;
    const newStart = new Date(date);
    newStart.setHours(0, 0, 0, 0);
    newStart.setMinutes(totalMin);

    const id = drag.reservationId;
    const partySize = drag.partySize;
    const durationMinutes = drag.durationMinutes;
    setDrag(null);

    const res = await actions.rescheduleReservation(id, newStart, partySize, durationMinutes);
    if (res.ok) {
      addToast(`Remarcada para ${newStart.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`, 'success');
      onChange?.();
    } else if (res.reason) {
      const messages: Record<string, string> = {
        feature_disabled: 'Sistema de reservas desabilitado.',
        before_min_advance: 'Antecedência mínima não atendida.',
        after_max_advance: 'Além da antecedência máxima.',
        outside_reservation_hours: 'Fora do horário que aceita reservas.',
        outside_operating_hours: 'Fora do horário de funcionamento.',
        date_blocked: 'Esta data não aceita reservas.',
        capacity_full: 'Sem capacidade nesse horário.',
      };
      const msg = messages[res.reason] ?? `Não foi possível remarcar (${res.reason})`;
      const lastBookable = res.dayWindow?.lastBookableStart;
      const detail = lastBookable && (res.reason === 'outside_reservation_hours' || res.reason === 'outside_operating_hours')
        ? ` Último horário do dia: ${lastBookable}.`
        : '';
      addToast(`${msg}${detail}`, 'error');
    } else {
      addToast(res.error ?? 'Erro ao remarcar', 'error');
    }
  };

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
    [weekStart],
  );

  const visibleDays = view === 'day' ? [currentDate] : weekDays;

  const { startHour, endHour } = useMemo(
    () => getWeekHourRange(config, visibleDays),
    [config, visibleDays],
  );

  const totalHours = endHour - startHour;
  const totalMinutes = totalHours * 60;
  const containerHeight = totalHours * PIXELS_PER_HOUR;
  const capacity = config?.defaultCapacity ?? 0;

  const reservationsByDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const key = ymdKey(r.start);
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [reservations]);

  const dayPeakOccupancy = useMemo(() => {
    const map = new Map<string, number>();
    for (const date of visibleDays) {
      const key = ymdKey(date);
      const dayRes = (reservationsByDay.get(key) ?? []).filter((r) => r.status === 'confirmed');
      // Pico de ocupação: para cada slot de 30min do dia, soma party_size dos overlapping
      let peak = 0;
      for (let m = 0; m < 24 * 60; m += SLOT_MINUTES) {
        const slotStart = new Date(date);
        slotStart.setHours(0, 0, 0, 0);
        slotStart.setMinutes(m);
        const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000);
        const sum = dayRes.reduce((acc, r) => {
          if (r.start < slotEnd && r.end > slotStart) return acc + r.partySize;
          return acc;
        }, 0);
        if (sum > peak) peak = sum;
      }
      map.set(key, peak);
    }
    return map;
  }, [visibleDays, reservationsByDay]);

  const prev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (view === 'week' ? 7 : 1));
    setCurrentDate(d);
  };
  const next = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (view === 'week' ? 7 : 1));
    setCurrentDate(d);
  };
  const goToday = () => setCurrentDate(new Date());

  const headerLabel = view === 'day'
    ? currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : weekStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 p-4 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-900/30">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
            {headerLabel}
          </h2>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-bold bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            <CalendarIcon size={12} />
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-200 dark:bg-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView('week')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${view === 'week' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setView('day')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${view === 'day' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Dia
            </button>
          </div>
          <button onClick={prev} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10" aria-label="Anterior">
            <ChevronLeft size={18} className="text-slate-600 dark:text-slate-400" />
          </button>
          <button onClick={next} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10" aria-label="Próximo">
            <ChevronRight size={18} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </header>

      {/* Calendar */}
      <div className="overflow-auto max-h-[700px]">
        <div className={`min-w-full ${view === 'day' ? '' : 'min-w-[920px]'}`}>
          {/* Day headers with capacity bar */}
          <div
            className="grid border-b border-slate-200 dark:border-white/10 sticky top-0 bg-white dark:bg-slate-900 z-10"
            style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)` }}
          >
            <div className="p-2 bg-slate-50 dark:bg-white/5" />
            {visibleDays.map((date, i) => {
              const peak = dayPeakOccupancy.get(ymdKey(date)) ?? 0;
              const peakPct = capacity > 0 ? Math.min(100, (peak / capacity) * 100) : 0;
              const meterColor = peakPct >= 90 ? 'bg-red-500' : peakPct >= 70 ? 'bg-orange-500' : peakPct > 0 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700';
              const blocked = findBlockedDate(config, date);
              const closed = isDayClosed(config, date);
              return (
                <div
                  key={i}
                  className={`p-3 border-l border-slate-200 dark:border-white/10 text-center ${isToday(date) ? 'bg-primary-50/50 dark:bg-primary-500/10' : 'bg-slate-50 dark:bg-white/5'}`}
                >
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {DAYS_OF_WEEK[date.getDay()]}
                  </div>
                  <div className={`text-xl font-black mt-0.5 font-display ${isToday(date) ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white'}`}>
                    {date.getDate()}
                  </div>
                  {/* Capacity bar */}
                  <div className="mt-2 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${meterColor} transition-all`} style={{ width: `${peakPct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums h-3">
                    {capacity > 0 && peak > 0 ? `${peak}/${capacity}` : ''}
                  </div>
                  {(blocked || closed) && (
                    <div className="mt-1 text-[9px] font-semibold text-amber-600 dark:text-amber-400 truncate">
                      {blocked ? blocked.reason : 'Fechado'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)`,
              height: `${containerHeight}px`,
            }}
          >
            {/* Hour labels column */}
            <div className="bg-slate-50 dark:bg-white/5 border-r border-slate-200 dark:border-white/10">
              {Array.from({ length: totalHours }, (_, i) => (
                <div
                  key={i}
                  className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pr-2 text-right"
                  style={{ height: `${PIXELS_PER_HOUR}px`, lineHeight: '1.5' }}
                >
                  {String(startHour + i).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {visibleDays.map((date, dayIdx) => {
              const dayRes = (reservationsByDay.get(ymdKey(date)) ?? []).filter(
                (r) => r.start.getHours() < endHour && r.end.getHours() >= startHour - 1,
              );
              const blocked = findBlockedDate(config, date);
              const isDragHovered = drag?.hoverDate && ymdKey(drag.hoverDate) === ymdKey(date);
              const dragGhostTopMin = isDragHovered ? (drag!.hoverMinute! - startHour * 60) : null;
              const dragGhostHeight = drag ? (drag.durationMinutes / 60) * PIXELS_PER_HOUR : 0;
              return (
                <div
                  key={dayIdx}
                  className={`relative border-l border-slate-200 dark:border-white/10 ${blocked ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''} ${isDragHovered ? 'ring-2 ring-primary-500/50 ring-inset' : ''}`}
                  onDragOver={(e) => onDragOverColumn(date, e, startHour)}
                  onDrop={(e) => onDropColumn(date, e, startHour)}
                >
                  {/* Drop ghost preview */}
                  {drag && isDragHovered && dragGhostTopMin !== null && dragGhostTopMin >= 0 && (
                    <div
                      className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-primary-500 bg-primary-500/15 pointer-events-none z-10"
                      style={{
                        top: `${(dragGhostTopMin / 60) * PIXELS_PER_HOUR}px`,
                        height: `${dragGhostHeight}px`,
                      }}
                    >
                      <div className="text-[10px] font-bold text-primary-700 dark:text-primary-300 p-1">
                        {String(Math.floor((startHour * 60 + dragGhostTopMin) / 60)).padStart(2, '0')}:{String((startHour * 60 + dragGhostTopMin) % 60).padStart(2, '0')}
                      </div>
                    </div>
                  )}
                  {/* Hour grid lines + closed slot shading */}
                  {Array.from({ length: totalHours }, (_, i) => {
                    const hour = startHour + i;
                    const slotOpen = isSlotOpen(config, date, hour);
                    return (
                      <div
                        key={i}
                        className={`border-b border-slate-100 dark:border-white/5 ${!slotOpen && !blocked ? 'bg-slate-100/60 dark:bg-slate-900/40' : ''}`}
                        style={{ height: `${PIXELS_PER_HOUR}px` }}
                      />
                    );
                  })}

                  {/* Now indicator */}
                  {isToday(date) && (() => {
                    const now = new Date();
                    const minutesFromStart = (now.getHours() - startHour) * 60 + now.getMinutes();
                    if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return null;
                    const top = (minutesFromStart / 60) * PIXELS_PER_HOUR;
                    return (
                      <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${top}px` }}>
                        <div className="h-0.5 bg-red-500 relative">
                          <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Reservation blocks */}
                  {dayRes.map((r) => {
                    const startMin = (r.start.getHours() - startHour) * 60 + r.start.getMinutes();
                    const top = (startMin / 60) * PIXELS_PER_HOUR;
                    const height = Math.max(20, (r.durationMinutes / 60) * PIXELS_PER_HOUR);
                    const isCanceled = r.status === 'canceled';
                    const isDragging = drag?.reservationId === r.id;
                    const isPending = !!actions.pending[r.id];
                    return (
                      <div
                        key={r.id}
                        draggable={!isCanceled && !isPending}
                        onDragStart={(e) => onDragStart(r, e)}
                        onDragEnd={onDragEnd}
                        className={`absolute left-1 right-1 rounded-lg p-2 text-white shadow-md overflow-hidden border-l-4 transition-all hover:z-20 ${
                          isCanceled
                            ? 'bg-slate-400 border-slate-600 opacity-70 cursor-default'
                            : isDragging
                            ? 'bg-gradient-to-br from-violet-500 to-purple-600 border-violet-700 opacity-40 cursor-grabbing'
                            : 'bg-gradient-to-br from-violet-500 to-purple-600 border-violet-700 shadow-violet-500/30 cursor-grab hover:scale-[1.02]'
                        }`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        title={`${r.contactName} — ${r.partySize} pessoas\n${r.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${r.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${isCanceled ? '' : '\nArraste pra remarcar'}\n${r.activity.description ?? ''}`}
                      >
                        <div className="flex items-start gap-1 mb-0.5">
                          {!isCanceled && (
                            <GripVertical size={10} className="text-white/60 flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-[11px] font-mono font-bold tabular-nums">
                            {r.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold bg-white/25 px-1.5 py-0.5 rounded">
                            <UsersIcon size={9} />
                            {r.partySize}
                          </span>
                        </div>
                        <div className={`text-xs font-semibold leading-tight line-clamp-2 ${isCanceled ? 'line-through' : ''}`}>
                          {r.contactName}
                        </div>
                        {isCanceled && (
                          <div className="text-[9px] uppercase tracking-wider font-bold mt-0.5">
                            Cancelada
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getDate() === today.getDate()
    && d.getMonth() === today.getMonth()
    && d.getFullYear() === today.getFullYear();
}

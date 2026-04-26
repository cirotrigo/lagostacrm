'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Users as UsersIcon } from 'lucide-react';
import type { Reservation } from '../hooks/useReservations';
import { findBlockedDate, isDayClosed, type SchedulingConfig } from '@/features/activities/hooks/useSchedulingConfig';

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Props {
  reservations: Reservation[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  config: SchedulingConfig | null;
}

export const ReservationsMonth: React.FC<Props> = ({ reservations, currentDate, setCurrentDate, config }) => {
  const monthStart = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return d;
  }, [currentDate]);

  const calendarDays = useMemo(() => {
    // Start from the Sunday on or before monthStart
    const start = new Date(monthStart);
    start.setDate(start.getDate() - start.getDay());
    // 6 weeks × 7 days = 42 cells (covers any month)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [monthStart]);

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

  const capacity = config?.defaultCapacity ?? 0;

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  return (
    <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
      <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-900/30">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
          {monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10" aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10" aria-label="Próximo mês">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="p-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date, i) => {
          const inMonth = date.getMonth() === monthStart.getMonth();
          const dayRes = (reservationsByDay.get(ymdKey(date)) ?? []).filter((r) => r.status === 'confirmed');
          const totalPeople = dayRes.reduce((s, r) => s + r.partySize, 0);
          const peakPct = capacity > 0 ? Math.min(100, (totalPeople / capacity) * 100) : 0;
          const meterColor = peakPct >= 90 ? 'bg-red-500' : peakPct >= 70 ? 'bg-orange-500' : peakPct > 0 ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700';
          const today = isToday(date);
          const blocked = findBlockedDate(config, date);
          const closed = isDayClosed(config, date);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentDate(new Date(date))}
              className={`min-h-[90px] p-2 border-l border-b border-slate-200 dark:border-white/10 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                !inMonth ? 'bg-slate-50/50 dark:bg-black/20 opacity-50' : ''
              } ${today ? 'bg-primary-50/40 dark:bg-primary-500/10' : ''} ${
                blocked ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className={`text-sm font-bold ${today ? 'text-primary-600 dark:text-primary-400' : inMonth ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {date.getDate()}
                </span>
                {dayRes.length > 0 && (
                  <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {dayRes.length}🍷
                  </span>
                )}
              </div>

              {inMonth && (closed || blocked) && (
                <div className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 leading-tight truncate">
                  {blocked ? blocked.reason : 'Fechado'}
                </div>
              )}

              {dayRes.length > 0 && (
                <>
                  <div className="mt-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${meterColor} transition-all`} style={{ width: `${peakPct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                    <UsersIcon size={9} />
                    <span className="font-semibold tabular-nums">{totalPeople}</span>
                    {capacity > 0 && <span>/{capacity}</span>}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

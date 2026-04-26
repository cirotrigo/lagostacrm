'use client';

import React, { useMemo, useState } from 'react';
import { CalendarClock, Users as UsersIcon, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useReservations, filterByRange, isSameDay, type Reservation } from './hooks/useReservations';
import { useSchedulingConfig } from '@/features/activities/hooks/useSchedulingConfig';
import { ReservationsCalendar } from './components/ReservationsCalendar';
import { ReservationsToday } from './components/ReservationsToday';
import { ReservationsFilters, applyReservationFilter, type ReservationFilter } from './components/ReservationsFilters';
import { ReservationsMonth } from './components/ReservationsMonth';

const ReservationsPage: React.FC = () => {
  const { reservations, loading, refetch } = useReservations();
  const { config } = useSchedulingConfig();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<ReservationFilter>({ search: '', status: 'all' });
  const [calendarTab, setCalendarTab] = useState<'week' | 'month'>('week');

  const filteredReservations = useMemo(
    () => applyReservationFilter(reservations, filter),
    [reservations, filter],
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const endOfWeek = useMemo(() => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + 7);
    return d;
  }, [startOfWeek]);

  const stats = useMemo(() => {
    const todayRes = reservations.filter((r) => isSameDay(r.start, today) && r.status === 'confirmed');
    const weekRes = filterByRange(reservations, startOfWeek, endOfWeek).filter((r) => r.status === 'confirmed');
    const weekPeople = weekRes.reduce((sum, r) => sum + r.partySize, 0);
    const todayPeople = todayRes.reduce((sum, r) => sum + r.partySize, 0);
    const capacity = config?.defaultCapacity ?? 0;
    const todayPctAvg = capacity > 0 && todayRes.length > 0
      ? Math.round((todayPeople / capacity) * 100 / Math.max(1, new Set(todayRes.map((r) => r.start.getHours())).size))
      : 0;
    const canceled = filterByRange(reservations, startOfWeek, endOfWeek).filter((r) => r.status === 'canceled');
    return {
      todayCount: todayRes.length,
      todayPeople,
      todayPctAvg,
      weekCount: weekRes.length,
      weekPeople,
      canceledCount: canceled.length,
      capacity,
    };
  }, [reservations, today, startOfWeek, endOfWeek, config]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg shadow-primary-500/30">
              <CalendarClock className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white font-display">
              Reservas
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 ml-12">
            Visão operacional das reservas — capacidade, lifecycle e ações rápidas.
          </p>
        </div>
        {!config?.enabled && !loading && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              Sistema de reservas desabilitado. Habilite em{' '}
              <a href="/settings/agendamento" className="underline font-semibold">Settings → Agendamento</a>.
            </span>
          </div>
        )}
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Hoje"
          value={stats.todayCount}
          subtitle={`${stats.todayPeople} pessoas`}
          icon={<CalendarClock className="h-5 w-5" />}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatCard
          label="Esta semana"
          value={stats.weekCount}
          subtitle={`${stats.weekPeople} pessoas`}
          icon={<UsersIcon className="h-5 w-5" />}
          gradient="from-violet-500 to-purple-600"
        />
        <StatCard
          label="Ocupação média hoje"
          value={`${stats.todayPctAvg}%`}
          subtitle={stats.capacity ? `de ${stats.capacity} lugares` : 'sem capacidade configurada'}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          label="Canceladas (semana)"
          value={stats.canceledCount}
          subtitle={stats.canceledCount > 0 ? 'liberadas pra novos clientes' : '\u00a0'}
          icon={<CheckCircle2 className="h-5 w-5" />}
          gradient="from-red-500 to-rose-600"
        />
      </div>

      {/* Today's reservations */}
      <ReservationsToday
        reservations={filteredReservations.filter((r) => isSameDay(r.start, today))}
        loading={loading}
        onRefresh={refetch}
      />

      {/* Filters */}
      <ReservationsFilters
        filter={filter}
        onChange={setFilter}
        totalCount={reservations.length}
        filteredCount={filteredReservations.length}
      />

      {/* Calendar with view toggle Semana / Mês */}
      <div className="flex justify-end print:hidden">
        <div className="flex bg-slate-100 dark:bg-white/5 rounded-xl p-0.5 border border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setCalendarTab('week')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${calendarTab === 'week' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Semana / Dia
          </button>
          <button
            type="button"
            onClick={() => setCalendarTab('month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${calendarTab === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Mês
          </button>
        </div>
      </div>

      {calendarTab === 'week' ? (
        <ReservationsCalendar
          reservations={filteredReservations}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          config={config}
        />
      ) : (
        <ReservationsMonth
          reservations={filteredReservations}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          config={config}
        />
      )}
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}> = ({ label, value, subtitle, icon, gradient }) => (
  <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 md:p-5 relative overflow-hidden">
    <div className={`absolute -right-3 -top-3 w-16 h-16 bg-gradient-to-br ${gradient} opacity-10 dark:opacity-20 rounded-full`} />
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          {icon}
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-display">
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {subtitle}
      </div>
    </div>
  </div>
);

export default ReservationsPage;

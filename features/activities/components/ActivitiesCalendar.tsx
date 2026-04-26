import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Phone, Users, Mail, CheckSquare } from 'lucide-react';
import { Activity, Deal } from '@/types';
import { findBlockedDate, getWeekHourRange, isDayClosed, isSlotOpen, useSchedulingConfig } from '../hooks/useSchedulingConfig';

interface ActivitiesCalendarProps {
    activities: Activity[];
    deals: Deal[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Componente React `ActivitiesCalendar`.
 *
 * @param {ActivitiesCalendarProps} {
    activities,
    deals,
    currentDate,
    setCurrentDate
} - Parâmetro `{
    activities,
    deals,
    currentDate,
    setCurrentDate
}`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const ActivitiesCalendar: React.FC<ActivitiesCalendarProps> = ({
    activities,
    deals,
    currentDate,
    setCurrentDate
}) => {
    const { config: schedulingConfig } = useSchedulingConfig();

    const getWeekStart = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };

    const weekStart = getWeekStart(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return date;
    });

    // Range dinâmico de horas baseado nas operating_hours do tenant
    const HOURS = useMemo(() => {
        const { startHour, endHour } = getWeekHourRange(schedulingConfig, weekDays);
        const range: number[] = [];
        for (let h = startHour; h < endHour; h++) range.push(h);
        return range;
    }, [schedulingConfig, weekDays]);

    // Capacidade total (soma das áreas, ou defaultCapacity)
    const totalCapacity = useMemo(() => {
        if (!schedulingConfig) return 0;
        return schedulingConfig.defaultCapacity || 0;
    }, [schedulingConfig]);

    const prevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const nextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const getActivityIcon = (type: Activity['type']) => {
        switch (type) {
            case 'CALL': return <Phone size={14} className="text-white" />;
            case 'MEETING': return <Users size={14} className="text-white" />;
            case 'EMAIL': return <Mail size={14} className="text-white" />;
            case 'TASK': return <CheckSquare size={14} className="text-white" />;
        }
    };

    const getActivityGradient = (type: Activity['type']) => {
        switch (type) {
            case 'CALL': return 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 border-blue-400';
            case 'MEETING': return 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 border-purple-400';
            case 'EMAIL': return 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50 hover:shadow-green-500/70 border-green-400';
            case 'TASK': return 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/50 hover:shadow-orange-500/70 border-orange-400';
        }
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const isOverdue = (activity: Activity) => {
        return new Date(activity.date) < new Date() && !activity.completed;
    };

    // Performance: grid chama `getActivitiesForDateTime` muitas vezes.
    // Indexamos atividades por (YYYY-MM-DD|hour) uma vez para evitar filters repetidos.
    const activitiesByDayHour = useMemo(() => {
        const map = new Map<string, Activity[]>();
        for (const a of activities) {
            const d = new Date(a.date);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${d.getHours()}`;
            const list = map.get(key);
            if (list) list.push(a);
            else map.set(key, [a]);
        }
        return map;
    }, [activities]);

    // Performance: evitar `deals.find` em hover/tooltips.
    const dealTitleById = useMemo(() => {
        const map = new Map<string, string>();
        for (const d of deals) map.set(d.id, d.title);
        return map;
    }, [deals]);

    /**
     * Calcula ocupação (soma de party_size de meetings confirmadas) que se sobrepõem
     * ao slot [date+hour, date+hour+1h). Considera duration_minutes da reserva.
     */
    const occupancyByDayHour = useMemo(() => {
        const map = new Map<string, number>();
        for (const a of activities) {
            if (a.type !== 'MEETING') continue;
            const status = a.metadata?.status;
            if (status && status !== 'confirmed') continue;
            const partySize = Number(a.metadata?.party_size ?? 0);
            if (partySize <= 0) continue;
            const duration = Number(a.metadata?.duration_minutes ?? 120);
            const start = new Date(a.date);
            const end = new Date(start.getTime() + duration * 60_000);
            // Distribui party_size em todos os slots de 1h que a reserva ocupa
            const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), 0, 0);
            while (cur < end) {
                const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}|${cur.getHours()}`;
                map.set(key, (map.get(key) ?? 0) + partySize);
                cur.setHours(cur.getHours() + 1);
            }
        }
        return map;
    }, [activities]);

    return (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-2xl text-slate-900 dark:text-white font-display">
                        {weekStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button
                        onClick={goToToday}
                        className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105"
                    >
                        <CalendarIcon size={14} />
                        Hoje
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={prevWeek} className="p-3 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all hover:scale-110">
                        <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <button onClick={nextWeek} className="p-3 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all hover:scale-110">
                        <ChevronRight size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-auto max-h-[650px]">
                <div className="min-w-[900px]">
                    {/* Day Headers */}
                    <div className="grid grid-cols-8 border-b border-slate-200 dark:border-white/10 sticky top-0 bg-white dark:bg-dark-card z-10 shadow-sm">
                        <div className="p-3 text-xs font-bold text-slate-500 uppercase bg-slate-50 dark:bg-white/5"></div>
                        {weekDays.map((date, i) => (
                            <div
                                key={i}
                                className={`p-4 text-center border-l border-slate-200 dark:border-white/10 transition-all ${isToday(date)
                                        ? 'bg-gradient-to-b from-primary-50 to-primary-100 dark:from-primary-500/20 dark:to-primary-500/10'
                                        : 'bg-slate-50 dark:bg-white/5'
                                    }`}
                            >
                                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    {DAYS_OF_WEEK[date.getDay()]}
                                </div>
                                <div className={`text-2xl font-black mt-1 font-display ${isToday(date)
                                        ? 'text-primary-600 dark:text-primary-400'
                                        : 'text-slate-900 dark:text-white'
                                    }`}>
                                    {date.getDate()}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Time Slots */}
                    {HOURS.map(hour => (
                        <div key={hour} className="grid grid-cols-8 border-b border-slate-200 dark:border-white/5">
                            <div className="p-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5 text-right pr-4">
                                {hour}:00
                            </div>
                            {weekDays.map((date, i) => {
                                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}|${hour}`;
                                const hourActivities = activitiesByDayHour.get(key) ?? [];
                                const blocked = findBlockedDate(schedulingConfig, date);
                                const dayClosed = isDayClosed(schedulingConfig, date);
                                const slotOpen = isSlotOpen(schedulingConfig, date, hour);
                                const occupancy = occupancyByDayHour.get(key) ?? 0;
                                const showMeter = slotOpen && totalCapacity > 0 && schedulingConfig?.enabled;
                                const occupancyPct = showMeter ? Math.min(100, (occupancy / totalCapacity) * 100) : 0;
                                const meterColor = occupancyPct >= 90 ? 'bg-red-500' : occupancyPct >= 70 ? 'bg-orange-500' : 'bg-green-500';
                                const slotBgClass = blocked
                                    ? 'bg-amber-50 dark:bg-amber-900/10 bg-stripes'
                                    : (dayClosed || !slotOpen)
                                    ? 'bg-slate-100/60 dark:bg-slate-900/30'
                                    : isToday(date)
                                    ? 'bg-primary-50/20 dark:bg-primary-500/5'
                                    : '';
                                return (
                                    <div
                                        key={i}
                                        className={`min-h-[70px] p-2 border-l border-slate-200 dark:border-white/10 transition-colors relative ${slotBgClass}`}
                                        title={blocked ? `🚫 ${blocked.reason} — ${blocked.mode === 'first_come' ? 'ordem de chegada' : 'fechado'}` : (!slotOpen && !dayClosed) ? 'Fora do horário de funcionamento' : undefined}
                                    >
                                        {/* Capacity meter */}
                                        {showMeter && (
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-white/10 overflow-hidden">
                                                <div
                                                    className={`h-full ${meterColor} transition-all`}
                                                    style={{ width: `${occupancyPct}%` }}
                                                />
                                            </div>
                                        )}
                                        {showMeter && occupancy > 0 && (
                                            <div className="absolute top-1 right-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-black/40 px-1 rounded">
                                                {occupancy}/{totalCapacity}
                                            </div>
                                        )}
                                        {/* Visual de dia bloqueado / fechado */}
                                        {blocked && hourActivities.length === 0 && hour === HOURS[0] && (
                                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold leading-tight">
                                                {blocked.reason}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {hourActivities.map(activity => (
                                                <div
                                                    key={activity.id}
                                                    className={`
                                                        group relative
                                                        text-xs p-3 rounded-xl border-2
                                                        ${getActivityGradient(activity.type)}
                                                        ${activity.completed ? 'opacity-50 saturate-50' : ''}
                                                        ${isOverdue(activity) && !activity.completed ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-slate-900' : ''}
                                                        transition-all duration-300
                                                        hover:scale-105 hover:-translate-y-1
                                                        cursor-pointer
                                                        overflow-hidden
                                                    `}
                                                    title={`${activity.title} - ${activity.dealId ? (dealTitleById.get(activity.dealId) ?? '') : ''}`}
                                                >
                                                    {/* Shine effect on hover */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>

                                                    <div className="relative z-10">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="p-1 bg-white/20 rounded-md">
                                                                {getActivityIcon(activity.type)}
                                                            </div>
                                                            <span className="font-black text-white text-sm">
                                                                {new Date(activity.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            {activity.metadata?.party_size && (
                                                                <span className="ml-auto px-1.5 py-0.5 bg-white/25 rounded text-white text-[11px] font-bold flex items-center gap-1">
                                                                    <Users size={10} />
                                                                    {activity.metadata.party_size}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {activity.metadata?.status === 'canceled' && (
                                                            <div className="text-[10px] text-white/90 font-semibold uppercase tracking-wider">
                                                                Cancelada
                                                            </div>
                                                        )}
                                                        <div className={`font-bold text-white leading-tight ${activity.completed || activity.metadata?.status === 'canceled' ? 'line-through' : ''}`}>
                                                            {activity.title}
                                                        </div>

                                                        {/* Hover Expanded Info */}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-2 pt-2 border-t border-white/20">
                                                            <p className="text-xs text-white/90 leading-relaxed">
                                                                {activity.description}
                                                            </p>
                                                            <p className="text-xs text-white/80 mt-1 font-medium">
                                                                📎 {activity.dealId ? (dealTitleById.get(activity.dealId) ?? 'Sem deal vinculado') : 'Sem deal vinculado'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

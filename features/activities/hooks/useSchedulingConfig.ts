'use client';

import { useEffect, useState } from 'react';

export type DayHours = { open: boolean; intervals: { start: string; end: string }[] };
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type OperatingHours = Partial<Record<Weekday, DayHours>>;
export type BlockedDate = { date: string; reason: string; mode: 'first_come' | 'closed'; message?: string };

export type SchedulingConfig = {
  enabled: boolean;
  defaultCapacity: number;
  slotDurationMinutes: number;
  slotStepMinutes: number;
  operatingHours: OperatingHours;
  reservationHours: OperatingHours;
  blockedDates: BlockedDate[];
};

export function useSchedulingConfig(): { config: SchedulingConfig | null; loading: boolean } {
  const [config, setConfig] = useState<SchedulingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/scheduling', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setConfig({
          enabled: !!data.enabled,
          defaultCapacity: data.defaultCapacity ?? 0,
          slotDurationMinutes: data.slotDurationMinutes ?? 120,
          slotStepMinutes: data.slotStepMinutes ?? 30,
          operatingHours: data.operatingHours ?? {},
          reservationHours: data.reservationHours ?? {},
          blockedDates: data.blockedDates ?? [],
        });
      })
      .catch(() => { /* fail silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { config, loading };
}

const WEEKDAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function getWeekdayKey(date: Date): Weekday {
  return WEEKDAYS[date.getDay()] ?? 'monday';
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Calcula o range de horas (em hora cheia) que o calendar deve mostrar pra um dia.
 * Pega o min(start) e max(end) dos operating_hours desse dia.
 * Fallback: 11h-22h se config não disponível.
 */
export function getDayHourRange(config: SchedulingConfig | null, date: Date): { startHour: number; endHour: number } {
  if (!config) return { startHour: 11, endHour: 22 };
  const day = getWeekdayKey(date);
  const hours = config.operatingHours[day];
  if (!hours || !hours.open || hours.intervals.length === 0) return { startHour: 11, endHour: 22 };
  let minStart = 24 * 60;
  let maxEnd = 0;
  for (const iv of hours.intervals) {
    minStart = Math.min(minStart, parseHHMM(iv.start));
    maxEnd = Math.max(maxEnd, parseHHMM(iv.end));
  }
  return {
    startHour: Math.floor(minStart / 60),
    endHour: Math.ceil(maxEnd / 60),
  };
}

/**
 * Range geral do calendar (pega min/max de toda a semana).
 */
export function getWeekHourRange(config: SchedulingConfig | null, weekDays: Date[]): { startHour: number; endHour: number } {
  if (!config) return { startHour: 11, endHour: 22 };
  let startHour = 24;
  let endHour = 0;
  for (const date of weekDays) {
    const { startHour: s, endHour: e } = getDayHourRange(config, date);
    if (s < startHour) startHour = s;
    if (e > endHour) endHour = e;
  }
  if (startHour >= endHour) return { startHour: 11, endHour: 22 };
  return { startHour, endHour };
}

export function findBlockedDate(config: SchedulingConfig | null, date: Date): BlockedDate | null {
  if (!config) return null;
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return config.blockedDates.find((b) => b.date === ymd) ?? null;
}

export function isDayClosed(config: SchedulingConfig | null, date: Date): boolean {
  if (!config) return false;
  const day = getWeekdayKey(date);
  const hours = config.operatingHours[day];
  return !hours || !hours.open || hours.intervals.length === 0;
}

/**
 * Verifica se um slot (date+hour) está dentro do horário operacional.
 */
export function isSlotOpen(config: SchedulingConfig | null, date: Date, hour: number): boolean {
  if (!config) return true;
  const day = getWeekdayKey(date);
  const hours = config.operatingHours[day];
  if (!hours || !hours.open) return false;
  const slotMin = hour * 60;
  return hours.intervals.some(({ start, end }) => slotMin >= parseHHMM(start) && slotMin < parseHHMM(end));
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { activitiesService } from '@/lib/supabase/activities';
import type { Activity } from '@/types';

export type Reservation = {
  id: string;
  activity: Activity;
  contactName: string;
  contactId: string | null;
  partySize: number;
  durationMinutes: number;
  start: Date;
  end: Date;
  status: 'confirmed' | 'canceled' | 'rescheduled' | 'completed';
};

const DEFAULT_DURATION = 120;

function toReservation(a: Activity): Reservation | null {
  if (a.type !== 'MEETING') return null;
  const partySize = Number(a.metadata?.party_size ?? 0);
  if (partySize <= 0) return null;
  const status = (a.metadata?.status as Reservation['status']) ?? 'confirmed';
  const durationMinutes = Number(a.metadata?.duration_minutes ?? DEFAULT_DURATION);
  const start = new Date(a.date);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    id: a.id,
    activity: a,
    contactName: a.title || a.dealTitle || 'Cliente',
    contactId: a.contactId ?? null,
    partySize,
    durationMinutes,
    start,
    end,
    status,
  };
}

export function useReservations(): {
  reservations: Reservation[];
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await activitiesService.getAll();
    setActivities(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const reservations = useMemo(
    () => activities.map(toReservation).filter((r): r is Reservation => r !== null),
    [activities],
  );

  return { reservations, loading, refetch: fetchAll };
}

/** Filtra reservations por janela [from, to). */
export function filterByRange(reservations: Reservation[], from: Date, to: Date): Reservation[] {
  return reservations.filter((r) => r.start >= from && r.start < to);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

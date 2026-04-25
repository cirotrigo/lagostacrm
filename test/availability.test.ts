import { describe, expect, it } from 'vitest';
import {
  computeOverlapSum,
  findBlockedDate,
  getCapacityForArea,
  isWithinOperatingHours,
  type ActivityRow,
  type SchedulingConfig,
} from '@/lib/public-api/availability';

const baseConfig: SchedulingConfig = {
  enabled: true,
  maxAdvanceDays: 30,
  minAdvanceMinutes: 90,
  defaultCapacity: 28,
  slotDurationMinutes: 120,
  slotStepMinutes: 30,
  operatingHours: {
    monday: { open: true, intervals: [{ start: '11:00', end: '22:00' }] },
    tuesday: { open: true, intervals: [{ start: '11:00', end: '22:00' }] },
    wednesday: { open: true, intervals: [{ start: '11:00', end: '22:00' }] },
    thursday: { open: true, intervals: [{ start: '11:00', end: '22:00' }] },
    friday: { open: true, intervals: [{ start: '11:00', end: '23:00' }] },
    saturday: { open: true, intervals: [{ start: '11:00', end: '23:00' }] },
    sunday: { open: false, intervals: [] },
  },
  blockedDates: [
    { date: '2026-05-10', reason: 'Dia das Mães', mode: 'first_come' },
    { date: '2026-12-25', reason: 'Natal', mode: 'closed' },
  ],
  areas: [],
};

describe('getCapacityForArea', () => {
  it('returns defaultCapacity when no areas configured', () => {
    expect(getCapacityForArea(baseConfig)).toBe(28);
  });

  it('returns total capacity across areas when no areaId given', () => {
    const cfg = { ...baseConfig, areas: [
      { id: 'salao', name: 'Salão', capacity: 20 },
      { id: 'terraco', name: 'Terraço', capacity: 8 },
    ]};
    expect(getCapacityForArea(cfg)).toBe(28);
  });

  it('returns specific area capacity when areaId given', () => {
    const cfg = { ...baseConfig, areas: [
      { id: 'salao', name: 'Salão', capacity: 20 },
      { id: 'terraco', name: 'Terraço', capacity: 8 },
    ]};
    expect(getCapacityForArea(cfg, 'terraco')).toBe(8);
  });

  it('returns 0 for unknown areaId', () => {
    expect(getCapacityForArea(baseConfig, 'unknown')).toBe(0);
  });
});

describe('findBlockedDate', () => {
  it('finds blocked date from ISO string', () => {
    const found = findBlockedDate(baseConfig, '2026-05-10T19:00:00Z');
    expect(found?.reason).toBe('Dia das Mães');
  });

  it('returns null when not blocked', () => {
    expect(findBlockedDate(baseConfig, '2026-04-26T19:00:00Z')).toBeNull();
  });
});

describe('isWithinOperatingHours', () => {
  it('returns true for normal monday slot', () => {
    // 2026-04-27 is a Monday
    const start = new Date('2026-04-27T19:00:00Z');
    const end = new Date('2026-04-27T21:00:00Z');
    expect(isWithinOperatingHours(baseConfig, start, end)).toBe(true);
  });

  it('returns false for closed sunday', () => {
    // 2026-04-26 is a Sunday
    const start = new Date('2026-04-26T19:00:00Z');
    const end = new Date('2026-04-26T21:00:00Z');
    expect(isWithinOperatingHours(baseConfig, start, end)).toBe(false);
  });

  it('returns false when slot starts before opening', () => {
    const start = new Date('2026-04-27T10:00:00Z'); // monday 10h, opens 11h
    const end = new Date('2026-04-27T12:00:00Z');
    expect(isWithinOperatingHours(baseConfig, start, end)).toBe(false);
  });

  it('returns false when slot ends after closing', () => {
    const start = new Date('2026-04-27T21:00:00Z'); // monday 21h-23h, closes 22h
    const end = new Date('2026-04-27T23:00:00Z');
    expect(isWithinOperatingHours(baseConfig, start, end)).toBe(false);
  });
});

describe('computeOverlapSum', () => {
  const start = new Date('2026-04-27T19:00:00Z');
  const end = new Date('2026-04-27T21:00:00Z');

  it('returns 0 when no overlapping rows', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T22:00:00Z', metadata: { party_size: 4, duration_minutes: 120, status: 'confirmed' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(0);
  });

  it('sums party_size for fully overlapping reservation', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 6, duration_minutes: 120, status: 'confirmed' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(6);
  });

  it('sums party_size for reservation that starts before window and extends into it', () => {
    const rows: ActivityRow[] = [
      // 18h-20h overlaps 19h-21h (overlap 19h-20h)
      { date: '2026-04-27T18:00:00Z', metadata: { party_size: 4, duration_minutes: 120, status: 'confirmed' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(4);
  });

  it('ignores reservations that touch window edge but do not overlap', () => {
    const rows: ActivityRow[] = [
      // 17h-19h ends at 19h, window starts 19h — no overlap (existingEnd > start fails when equal)
      { date: '2026-04-27T17:00:00Z', metadata: { party_size: 4, duration_minutes: 120, status: 'confirmed' } },
      // 21h-23h starts at 21h, window ends 21h — no overlap
      { date: '2026-04-27T21:00:00Z', metadata: { party_size: 4, duration_minutes: 120, status: 'confirmed' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(0);
  });

  it('ignores canceled reservations', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 6, duration_minutes: 120, status: 'canceled' } },
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 4, duration_minutes: 120, status: 'confirmed' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(4);
  });

  it('ignores rescheduled reservations', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 6, duration_minutes: 120, status: 'rescheduled' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(0);
  });

  it('treats no status as confirmed (legacy compat)', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 6, duration_minutes: 120 } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(6);
  });

  it('sums multiple overlapping reservations', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:00:00Z', metadata: { party_size: 6, duration_minutes: 120, status: 'confirmed' } },
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 4, duration_minutes: 120, status: 'confirmed' } },
      { date: '2026-04-27T20:00:00Z', metadata: { party_size: 8, duration_minutes: 120, status: 'confirmed' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: null })).toBe(18);
  });

  it('filters by areaId when provided (rows com area diferente são ignorados)', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 6, duration_minutes: 120, status: 'confirmed', area_id: 'salao' } },
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 4, duration_minutes: 120, status: 'confirmed', area_id: 'terraco' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: 'salao' })).toBe(6);
    expect(computeOverlapSum({ rows, start, end, areaId: 'terraco' })).toBe(4);
  });

  it('includes rows without area_id when filtering by area', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 6, duration_minutes: 120, status: 'confirmed' } },
    ];
    expect(computeOverlapSum({ rows, start, end, areaId: 'salao' })).toBe(6);
  });

  it('uses defaultDurationMinutes when row metadata lacks duration', () => {
    const rows: ActivityRow[] = [
      { date: '2026-04-27T19:30:00Z', metadata: { party_size: 6, status: 'confirmed' } },
    ];
    // default 120: 19:30-21:30 overlaps 19h-21h
    expect(computeOverlapSum({ rows, start, end, areaId: null, defaultDurationMinutes: 120 })).toBe(6);
    // default 30: 19:30-20:00 still overlaps 19h-21h
    expect(computeOverlapSum({ rows, start, end, areaId: null, defaultDurationMinutes: 30 })).toBe(6);
  });
});

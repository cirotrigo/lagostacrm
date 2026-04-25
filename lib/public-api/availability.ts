import { createStaticAdminClient } from '@/lib/supabase/server';

export type SchedulingConfig = {
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

export type OperatingHours = Partial<Record<Weekday, DayHours>>;
export type Weekday =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';
export type DayHours = { open: boolean; intervals: { start: string; end: string }[] };

export type BlockedDate = {
  date: string;       // YYYY-MM-DD
  reason: string;
  mode: 'first_come' | 'closed';
  message?: string;
};

export type Area = { id: string; name: string; capacity: number };

export type AvailabilityRequest = {
  organizationId: string;
  start: Date;
  partySize: number;
  durationMinutes?: number;
  areaId?: string;
};

export type AvailabilityResult = {
  available: boolean;
  reason?: 'feature_disabled' | 'before_min_advance' | 'after_max_advance' | 'outside_operating_hours' | 'date_blocked' | 'capacity_full';
  blockedInfo?: BlockedDate;
  bookedInWindow: number;
  capacity: number;
  availableCapacity: number;
  durationMinutes: number;
  start: string;
  end: string;
  suggestions?: { start: string; availableCapacity: number }[];
};

const WEEKDAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export async function loadSchedulingConfig(organizationId: string): Promise<SchedulingConfig | null> {
  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('organization_settings')
    .select(`
      scheduling_enabled,
      scheduling_max_advance_days,
      scheduling_min_advance_minutes,
      scheduling_default_capacity,
      scheduling_slot_duration_minutes,
      scheduling_slot_step_minutes,
      scheduling_operating_hours,
      scheduling_blocked_dates,
      scheduling_areas
    `)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    enabled: !!(data as any).scheduling_enabled,
    maxAdvanceDays: Number((data as any).scheduling_max_advance_days ?? 30),
    minAdvanceMinutes: Number((data as any).scheduling_min_advance_minutes ?? 90),
    defaultCapacity: Number((data as any).scheduling_default_capacity ?? 0),
    slotDurationMinutes: Number((data as any).scheduling_slot_duration_minutes ?? 120),
    slotStepMinutes: Number((data as any).scheduling_slot_step_minutes ?? 30),
    operatingHours: ((data as any).scheduling_operating_hours ?? {}) as OperatingHours,
    blockedDates: ((data as any).scheduling_blocked_dates ?? []) as BlockedDate[],
    areas: ((data as any).scheduling_areas ?? []) as Area[],
  };
}

export function getCapacityForArea(config: SchedulingConfig, areaId?: string | null): number {
  if (!areaId) {
    if (config.areas.length === 0) return config.defaultCapacity;
    return config.areas.reduce((sum, a) => sum + (a.capacity || 0), 0);
  }
  const area = config.areas.find((a) => a.id === areaId);
  return area ? area.capacity : 0;
}

export function findBlockedDate(config: SchedulingConfig, dateISO: string): BlockedDate | null {
  const ymd = dateISO.slice(0, 10);
  return config.blockedDates.find((b) => b.date === ymd) ?? null;
}

export function getWeekday(date: Date): Weekday {
  return WEEKDAYS[date.getUTCDay()] ?? 'monday';
}

/**
 * Checa se start..end cai inteiramente dentro de algum intervalo de horário do dia.
 * Aceita operação 24h se intervalo cobrir 00:00–23:59.
 */
export function isWithinOperatingHours(
  config: SchedulingConfig,
  start: Date,
  end: Date,
): boolean {
  const day = getWeekday(start);
  const hours = config.operatingHours[day];
  if (!hours || !hours.open || hours.intervals.length === 0) return false;

  const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMin = end.getUTCHours() * 60 + end.getUTCMinutes() + (end.getUTCDate() !== start.getUTCDate() ? 24 * 60 : 0);

  return hours.intervals.some(({ start: s, end: e }) => {
    const intervalStart = parseHHMM(s);
    const intervalEnd = parseHHMM(e);
    return startMin >= intervalStart && endMin <= intervalEnd;
  });
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Verifica disponibilidade de um slot.
 * Retorna available + capacidade ocupada/disponível + sugestões se rejeitado.
 */
export async function checkAvailability(req: AvailabilityRequest): Promise<AvailabilityResult> {
  const config = await loadSchedulingConfig(req.organizationId);
  const durationMinutes = req.durationMinutes ?? config?.slotDurationMinutes ?? 120;
  const start = req.start;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const capacity = config ? getCapacityForArea(config, req.areaId) : 0;

  const baseResult = {
    bookedInWindow: 0,
    capacity,
    availableCapacity: capacity,
    durationMinutes,
    start: start.toISOString(),
    end: end.toISOString(),
  };

  if (!config || !config.enabled) {
    return { available: false, reason: 'feature_disabled', ...baseResult };
  }

  // Antecedência
  const now = Date.now();
  const minutesAhead = (start.getTime() - now) / 60_000;
  if (minutesAhead < config.minAdvanceMinutes) {
    return { available: false, reason: 'before_min_advance', ...baseResult };
  }
  if (minutesAhead > config.maxAdvanceDays * 24 * 60) {
    return { available: false, reason: 'after_max_advance', ...baseResult };
  }

  // Data bloqueada
  const blocked = findBlockedDate(config, start.toISOString());
  if (blocked) {
    return { available: false, reason: 'date_blocked', blockedInfo: blocked, ...baseResult };
  }

  // Horário de funcionamento
  if (!isWithinOperatingHours(config, start, end)) {
    return { available: false, reason: 'outside_operating_hours', ...baseResult };
  }

  // Capacidade
  const booked = await sumOverlappingPartySizes({
    organizationId: req.organizationId,
    start,
    end,
    areaId: req.areaId ?? null,
  });

  const availableCapacity = capacity - booked;
  if (availableCapacity < req.partySize) {
    const suggestions = await suggestAlternativeSlots({
      organizationId: req.organizationId,
      config,
      around: start,
      partySize: req.partySize,
      durationMinutes,
      areaId: req.areaId ?? null,
    });
    return {
      available: false,
      reason: 'capacity_full',
      ...baseResult,
      bookedInWindow: booked,
      availableCapacity,
      suggestions,
    };
  }

  return {
    available: true,
    ...baseResult,
    bookedInWindow: booked,
    availableCapacity,
  };
}

export type ActivityRow = {
  date: string;
  metadata?: {
    party_size?: number;
    duration_minutes?: number;
    status?: string;
    area_id?: string;
  } | null;
};

/**
 * Pure function: calcula a soma de party_size dos rows que se sobrepõem à janela [start, end).
 * Reservas com status != 'confirmed' são ignoradas.
 * Se areaId for passado, filtra rows da mesma área (rows sem area_id são incluídos por padrão).
 */
export function computeOverlapSum(opts: {
  rows: ActivityRow[];
  start: Date;
  end: Date;
  areaId: string | null;
  defaultDurationMinutes?: number;
}): number {
  const defaultDuration = opts.defaultDurationMinutes ?? 120;
  let sum = 0;
  for (const row of opts.rows) {
    const meta = row.metadata ?? {};
    if (meta.status && meta.status !== 'confirmed') continue;
    if (opts.areaId && meta.area_id && meta.area_id !== opts.areaId) continue;
    const ps = Number(meta.party_size ?? 0);
    if (ps <= 0) continue;
    const existingStart = new Date(row.date);
    const existingEnd = new Date(existingStart.getTime() + Number(meta.duration_minutes ?? defaultDuration) * 60_000);
    if (existingStart < opts.end && existingEnd > opts.start) sum += ps;
  }
  return sum;
}

/**
 * Busca activities tipo 'meeting' na janela ±24h e calcula overlap via computeOverlapSum.
 */
export async function sumOverlappingPartySizes(opts: {
  organizationId: string;
  start: Date;
  end: Date;
  areaId: string | null;
  defaultDurationMinutes?: number;
}): Promise<number> {
  const sb = createStaticAdminClient();
  const startDate = new Date(opts.start.getTime() - 24 * 60 * 60_000);
  const endDate = new Date(opts.end.getTime() + 24 * 60 * 60_000);

  const { data, error } = await sb
    .from('activities')
    .select('date, metadata')
    .eq('organization_id', opts.organizationId)
    .eq('type', 'meeting')
    .is('deleted_at', null)
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());
  if (error) throw error;

  return computeOverlapSum({
    rows: (data ?? []) as ActivityRow[],
    start: opts.start,
    end: opts.end,
    areaId: opts.areaId,
    defaultDurationMinutes: opts.defaultDurationMinutes,
  });
}

/**
 * Sugere até 4 slots alternativos próximos com capacidade pro party_size pedido.
 * Procura ±4h em incrementos de slotStepMinutes.
 */
export async function suggestAlternativeSlots(opts: {
  organizationId: string;
  config: SchedulingConfig;
  around: Date;
  partySize: number;
  durationMinutes: number;
  areaId: string | null;
}): Promise<{ start: string; availableCapacity: number }[]> {
  const stepMs = opts.config.slotStepMinutes * 60_000;
  const candidates: { start: string; availableCapacity: number }[] = [];
  for (let offset = -8; offset <= 8 && candidates.length < 4; offset++) {
    if (offset === 0) continue;
    const start = new Date(opts.around.getTime() + offset * stepMs);
    const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
    if (!isWithinOperatingHours(opts.config, start, end)) continue;
    const blocked = findBlockedDate(opts.config, start.toISOString());
    if (blocked) continue;
    const booked = await sumOverlappingPartySizes({
      organizationId: opts.organizationId,
      start,
      end,
      areaId: opts.areaId,
    });
    const capacity = getCapacityForArea(opts.config, opts.areaId ?? undefined);
    const available = capacity - booked;
    if (available >= opts.partySize) {
      candidates.push({ start: start.toISOString(), availableCapacity: available });
    }
  }
  return candidates;
}

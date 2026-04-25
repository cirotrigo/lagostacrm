import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm');

const IntervalSchema = z.object({
  start: HHMM,
  end: HHMM,
}).strict();

const DayHoursSchema = z.object({
  open: z.boolean(),
  intervals: z.array(IntervalSchema),
}).strict();

const OperatingHoursSchema = z.object({
  monday: DayHoursSchema.optional(),
  tuesday: DayHoursSchema.optional(),
  wednesday: DayHoursSchema.optional(),
  thursday: DayHoursSchema.optional(),
  friday: DayHoursSchema.optional(),
  saturday: DayHoursSchema.optional(),
  sunday: DayHoursSchema.optional(),
}).strict();

const BlockedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1),
  mode: z.enum(['first_come', 'closed']),
  message: z.string().optional(),
}).strict();

const AreaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  capacity: z.number().int().nonnegative(),
}).strict();

const SchedulingPayloadSchema = z.object({
  enabled: z.boolean().optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
  minAdvanceMinutes: z.number().int().min(0).max(60 * 24 * 7).optional(),
  defaultCapacity: z.number().int().min(0).optional(),
  slotDurationMinutes: z.number().int().min(15).max(60 * 12).optional(),
  slotStepMinutes: z.number().int().min(5).max(120).optional(),
  operatingHours: OperatingHoursSchema.optional(),
  blockedDates: z.array(BlockedDateSchema).optional(),
  areas: z.array(AreaSchema).optional(),
}).strict();

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const { data: row, error } = await supabase
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
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);

  return json({
    enabled: !!row?.scheduling_enabled,
    maxAdvanceDays: row?.scheduling_max_advance_days ?? 30,
    minAdvanceMinutes: row?.scheduling_min_advance_minutes ?? 90,
    defaultCapacity: row?.scheduling_default_capacity ?? 0,
    slotDurationMinutes: row?.scheduling_slot_duration_minutes ?? 120,
    slotStepMinutes: row?.scheduling_slot_step_minutes ?? 30,
    operatingHours: row?.scheduling_operating_hours ?? {},
    blockedDates: row?.scheduling_blocked_dates ?? [],
    areas: row?.scheduling_areas ?? [],
  });
}

export async function PUT(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) return json({ error: 'Profile not found' }, 404);
  if (profile.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const rawBody = await req.json().catch(() => null);
  const parsed = SchedulingPayloadSchema.safeParse(rawBody);
  if (!parsed.success) return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);

  const data = parsed.data;
  const dbUpdates: Record<string, unknown> = {
    organization_id: profile.organization_id,
    updated_at: new Date().toISOString(),
  };
  if (data.enabled !== undefined) dbUpdates.scheduling_enabled = data.enabled;
  if (data.maxAdvanceDays !== undefined) dbUpdates.scheduling_max_advance_days = data.maxAdvanceDays;
  if (data.minAdvanceMinutes !== undefined) dbUpdates.scheduling_min_advance_minutes = data.minAdvanceMinutes;
  if (data.defaultCapacity !== undefined) dbUpdates.scheduling_default_capacity = data.defaultCapacity;
  if (data.slotDurationMinutes !== undefined) dbUpdates.scheduling_slot_duration_minutes = data.slotDurationMinutes;
  if (data.slotStepMinutes !== undefined) dbUpdates.scheduling_slot_step_minutes = data.slotStepMinutes;
  if (data.operatingHours !== undefined) dbUpdates.scheduling_operating_hours = data.operatingHours;
  if (data.blockedDates !== undefined) dbUpdates.scheduling_blocked_dates = data.blockedDates;
  if (data.areas !== undefined) dbUpdates.scheduling_areas = data.areas;

  const { error: upsertError } = await supabase
    .from('organization_settings')
    .upsert(dbUpdates, { onConflict: 'organization_id' });
  if (upsertError) return json({ error: upsertError.message }, 500);

  return json({ ok: true });
}

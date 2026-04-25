import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { checkAvailability } from '@/lib/public-api/availability';

export const runtime = 'nodejs';

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const Schema = z.object({
  start: z.string().min(1),
  party_size: z.number().int().positive(),
  duration_minutes: z.preprocess(emptyToUndefined, z.number().int().positive().optional()),
  area_id: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
}).strict();

export async function POST(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const start = new Date(parsed.data.start);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Invalid start date', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  try {
    const result = await checkAvailability({
      organizationId: auth.organizationId,
      start,
      partySize: parsed.data.party_size,
      durationMinutes: parsed.data.duration_minutes,
      areaId: parsed.data.area_id,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

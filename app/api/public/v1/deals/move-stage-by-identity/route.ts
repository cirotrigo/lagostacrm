import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { moveStageByIdentity } from '@/lib/public-api/dealsMoveStage';

export const runtime = 'nodejs';

const CHANNEL_ENUM = ['whatsapp','instagram','messenger','telegram','email','sms','other'] as const;

// n8n templates render missing fields as empty strings rather than omitting them.
// Treat "" and whitespace-only values as undefined so optional fields with
// format constraints (uuid, enum, min(1)) don't reject the payload.
const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const MoveStageByIdentitySchema = z.object({
  board_key_or_id: z.string().min(1),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  email: z.preprocess(emptyToUndefined, z.string().optional()),
  channel: z.preprocess(emptyToUndefined, z.enum(CHANNEL_ENUM).optional()),
  identifier: z.preprocess(emptyToUndefined, z.string().optional()),
  contact_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  to_stage_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  to_stage_label: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  mark: z.preprocess(emptyToUndefined, z.enum(['won', 'lost']).optional()),
  ai_summary: z.preprocess(emptyToUndefined, z.string().optional()),
}).strict()
  .refine(
    (v) => !!(v.contact_id || v.phone || v.email || (v.channel && v.identifier)),
    { message: 'contact_id, phone, email, or (channel + identifier) is required' }
  )
  .refine((v) => !!(v.to_stage_id || v.to_stage_label), { message: 'to_stage_id or to_stage_label is required' });

export async function POST(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = MoveStageByIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const res = await moveStageByIdentity({
    organizationId: auth.organizationId,
    boardKeyOrId: parsed.data.board_key_or_id,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    channel: parsed.data.channel ?? null,
    identifier: parsed.data.identifier ?? null,
    contactId: parsed.data.contact_id ?? null,
    target: { to_stage_id: parsed.data.to_stage_id ?? null, to_stage_label: parsed.data.to_stage_label ?? null },
    mark: parsed.data.mark ?? null,
    aiSummary: parsed.data.ai_summary ?? null,
  });
  // Compatibility alias (old name) — keep working.
  return NextResponse.json(res.body, { status: res.status });
}


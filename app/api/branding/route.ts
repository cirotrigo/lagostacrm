import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { getBrandingFromDb, getBranding } from '@/lib/branding';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=300',
    },
  });
}

/**
 * GET /api/branding
 * Retorna configuração de branding da organização do usuário logado.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const brand = await getBrandingFromDb(supabase);
    return json(brand);
  } catch {
    return json(getBranding());
  }
}

// --- POST: Atualizar branding ---

const UpdateBrandingSchema = z
  .object({
    brandName: z.string().min(1).max(100).optional(),
    brandShortName: z.string().min(1).max(50).optional(),
    brandPrimaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser hex válido (ex: #FF6B00)')
      .optional(),
    brandLogoUrl: z.string().url().max(500).optional().or(z.literal('')),
    brandDescription: z.string().max(200).optional(),
  })
  .strict();

/**
 * POST /api/branding
 * Atualiza configuração de branding da organização. Apenas admins.
 */
export async function POST(req: Request) {
  // CSRF
  if (!isAllowedOrigin(req)) {
    return json({ error: 'Forbidden' }, 403);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return json({ error: 'Profile not found' }, 404);
  }

  if (profile.role !== 'admin') {
    return json({ error: 'Forbidden' }, 403);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = UpdateBrandingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const updates = parsed.data;

  const dbUpdates: Record<string, unknown> = {
    organization_id: profile.organization_id,
    updated_at: new Date().toISOString(),
  };

  if (updates.brandName !== undefined) dbUpdates.brand_name = updates.brandName;
  if (updates.brandShortName !== undefined) dbUpdates.brand_short_name = updates.brandShortName;
  if (updates.brandPrimaryColor !== undefined) dbUpdates.brand_primary_color = updates.brandPrimaryColor;
  if (updates.brandLogoUrl !== undefined) dbUpdates.brand_logo_url = updates.brandLogoUrl || null;
  if (updates.brandDescription !== undefined) dbUpdates.brand_description = updates.brandDescription;

  const { error: upsertError } = await supabase
    .from('organization_settings')
    .upsert(dbUpdates, { onConflict: 'organization_id' });

  if (upsertError) {
    return json({ error: upsertError.message }, 500);
  }

  return json({ ok: true });
}

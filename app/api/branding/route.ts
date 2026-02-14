import { createClient } from '@/lib/supabase/server';
import { getBranding, type BrandConfig } from '@/lib/branding';

export const dynamic = 'force-dynamic';

/**
 * GET /api/branding
 *
 * Retorna a configuração de branding da organização.
 * Endpoint público (sem auth) para uso em tela de login, manifest, etc.
 *
 * Prioridade:
 * 1. organization_settings.brand_* do banco
 * 2. NEXT_PUBLIC_BRAND_* env vars
 * 3. CLIENT_ID hardcoded fallback
 */
export async function GET(): Promise<Response> {
  try {
    const supabase = await createClient();

    // Busca branding da primeira organização (single-tenant)
    const { data, error } = await supabase
      .from('organization_settings')
      .select(
        'brand_name, brand_short_name, brand_initial, brand_description, brand_logo_url, brand_favicon_url, brand_primary_color'
      )
      .limit(1)
      .single();

    if (error || !data?.brand_name) {
      // Fallback para env vars ou CLIENT_ID
      return Response.json(getBranding(), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=600', // 10 min cache
        },
      });
    }

    const brand: BrandConfig = {
      name: data.brand_name,
      shortName: data.brand_short_name || data.brand_name,
      initial: data.brand_initial || data.brand_name[0],
      description: data.brand_description || `CRM - ${data.brand_name}`,
      primaryColor: data.brand_primary_color || '#3B82F6',
      logoUrl: data.brand_logo_url || undefined,
      faviconUrl: data.brand_favicon_url || undefined,
    };

    return Response.json(brand, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=600', // 10 min cache
      },
    });
  } catch {
    // Em caso de erro, fallback para sync branding
    return Response.json(getBranding(), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60', // 1 min cache on error
      },
    });
  }
}

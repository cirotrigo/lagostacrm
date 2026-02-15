import { createClient } from '@/lib/supabase/server';
import { getBrandingFromDb, getBranding } from '@/lib/branding';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=300', // cache 5 min
    },
  });
}

/**
 * GET /api/branding
 * Retorna configuração de branding da organização do usuário logado.
 * Se não autenticado ou sem branding no banco, retorna fallback do CLIENT_ID.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const brand = await getBrandingFromDb(supabase);
    return json(brand);
  } catch {
    // Fallback seguro
    return json(getBranding());
  }
}

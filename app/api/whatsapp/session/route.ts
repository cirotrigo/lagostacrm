import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { cookies } from 'next/headers';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const WPPCONNECT_HOST = process.env.WPPCONNECT_HOST;
const WPPCONNECT_SECRET_KEY = process.env.WPPCONNECT_SECRET_KEY;
const WPPCONNECT_TOKEN = process.env.WPPCONNECT_TOKEN;
const WPPCONNECT_SESSION_NAME = process.env.WPPCONNECT_SESSION_NAME || 'lagostacrm';

// Use TOKEN for API auth (bcrypt hash), SECRET_KEY is for webhook validation
const API_AUTH_TOKEN = WPPCONNECT_TOKEN || WPPCONNECT_SECRET_KEY;

/**
 * GET /api/whatsapp/session
 * Retorna status da sessão WhatsApp (Supabase + WPPConnect)
 */
export async function GET() {
  // Debug: Log cookies received
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const supabaseCookies = allCookies.filter(c => c.name.includes('supabase') || c.name.includes('sb-'));

  console.log('[Session Route] Request received:', {
    totalCookies: allCookies.length,
    supabaseCookieNames: supabaseCookies.map(c => c.name),
    hasAuthCookie: supabaseCookies.some(c => c.name.includes('auth-token')),
  });

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Debug logging for production troubleshooting
  console.log('[Session Route] Auth result:', {
    hasUser: !!user,
    userId: user?.id?.substring(0, 8) || null,
    authError: authError?.message || null,
  });

  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return json({ error: 'Profile not found' }, 404);
  }

  // Busca sessão no Supabase
  const { data: session, error: sessionError } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('session_name', WPPCONNECT_SESSION_NAME)
    .maybeSingle();

  if (sessionError) {
    return json({ error: sessionError.message }, 500);
  }

  // Se WPPConnect está configurado, busca status em tempo real
  let wppStatus = null;
  if (WPPCONNECT_HOST && API_AUTH_TOKEN) {
    try {
      const response = await fetch(
        `${WPPCONNECT_HOST}/api/${WPPCONNECT_SESSION_NAME}/status-session`,
        {
          headers: {
            Authorization: `Bearer ${API_AUTH_TOKEN}`,
          },
        }
      );
      if (response.ok) {
        wppStatus = await response.json();
      }
    } catch {
      // WPPConnect indisponível, usa apenas dados do Supabase
    }
  }

  return json({
    session: session || null,
    wppStatus,
    sessionName: WPPCONNECT_SESSION_NAME,
    isConfigured: Boolean(WPPCONNECT_HOST && API_AUTH_TOKEN),
  });
}

const StartSessionSchema = z.object({
  action: z.enum(['start', 'stop', 'logout']),
});

/**
 * POST /api/whatsapp/session
 * Inicia, para ou desconecta sessão WhatsApp
 */
export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return json({ error: 'Forbidden' }, 403);
  }

  if (!WPPCONNECT_HOST || !API_AUTH_TOKEN) {
    return json({ error: 'WPPConnect not configured' }, 503);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return json({ error: 'Profile not found' }, 404);
  }

  // Apenas admins podem gerenciar sessão
  if (profile.role !== 'admin') {
    return json({ error: 'Forbidden' }, 403);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = StartSessionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'Invalid payload' }, 400);
  }

  const { action } = parsed.data;

  try {
    let endpoint = '';
    let method = 'POST';

    switch (action) {
      case 'start':
        endpoint = `${WPPCONNECT_HOST}/api/${WPPCONNECT_SESSION_NAME}/start-session`;
        break;
      case 'stop':
        endpoint = `${WPPCONNECT_HOST}/api/${WPPCONNECT_SESSION_NAME}/close-session`;
        break;
      case 'logout':
        endpoint = `${WPPCONNECT_HOST}/api/${WPPCONNECT_SESSION_NAME}/logout-session`;
        break;
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${API_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json().catch(() => ({}));

    // Atualiza status no Supabase
    const statusMap: Record<string, string> = {
      start: 'connecting',
      stop: 'disconnected',
      logout: 'disconnected',
    };

    await supabase.from('whatsapp_sessions').upsert(
      {
        organization_id: profile.organization_id,
        session_name: WPPCONNECT_SESSION_NAME,
        status: statusMap[action],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,session_name' }
    );

    return json({ ok: true, action, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
}

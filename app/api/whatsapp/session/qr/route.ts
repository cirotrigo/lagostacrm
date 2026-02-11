import { createClient } from '@/lib/supabase/server';

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
 * GET /api/whatsapp/session/qr
 * Retorna QR Code para escaneamento (base64)
 */
export async function GET() {
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
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return json({ error: 'Profile not found' }, 404);
  }

  try {
    // Usa status-session que retorna JSON com QR code base64
    const wppUrl = `${WPPCONNECT_HOST}/api/${WPPCONNECT_SESSION_NAME}/status-session`;

    const response = await fetch(wppUrl, {
      headers: {
        Authorization: `Bearer ${API_AUTH_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return json(
        { error: 'Failed to get QR code', details: errorData },
        response.status
      );
    }

    const data = await response.json();

    // Atualiza QR code no Supabase para histórico
    if (data.qrcode) {
      await supabase.from('whatsapp_sessions').upsert(
        {
          organization_id: profile.organization_id,
          session_name: WPPCONNECT_SESSION_NAME,
          status: 'qr_pending',
          qr_code: data.qrcode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,session_name' }
      );
    }

    return json({
      qrCode: data.qrcode || null,
      status: data.status || 'qr_pending',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
}

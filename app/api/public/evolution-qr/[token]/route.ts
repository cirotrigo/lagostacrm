import { createStaticAdminClient } from '@/lib/supabase/server';
import { connect, getStatus, loadInstanceById } from '@/lib/integrations/evolution-api';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * GET /api/public/evolution-qr/[token]
 * Endpoint público (sem auth) consumido pela página /connect-whatsapp/[token].
 *
 * Valida o token, busca a instância, retorna status atual e QR code se for
 * preciso reconectar. NUNCA expõe api_key nem dados sensíveis da org.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) return json({ error: 'Invalid token' }, 400);

  const sb = createStaticAdminClient();
  const { data: row, error } = await sb
    .from('evolution_connect_tokens')
    .select('id, instance_id, expires_at, consumed_at')
    .eq('token', token)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!row) return json({ error: 'Token not found' }, 404);

  const now = Date.now();
  if (new Date((row as any).expires_at).getTime() < now) {
    return json({ error: 'Token expired' }, 410);
  }

  const instance = await loadInstanceById((row as any).instance_id);
  if (!instance) return json({ error: 'Instance not found' }, 404);

  let status;
  try {
    status = await getStatus(instance);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed to fetch status' }, 502);
  }

  // Se já está conectado, não precisa de QR
  if (status.state === 'open') {
    return json({
      state: status.state,
      profileName: status.profileName,
      profilePictureUrl: status.profilePictureUrl,
      phoneNumber: status.ownerJid ? status.ownerJid.replace(/@.*/, '') : null,
      instanceName: instance.instance_name,
    });
  }

  // Senão, gera QR
  let qr;
  try {
    qr = await connect(instance);
  } catch (e) {
    return json({
      state: status.state,
      qrBase64: null,
      pairingCode: null,
      instanceName: instance.instance_name,
      error: e instanceof Error ? e.message : 'connect failed',
    });
  }

  return json({
    state: status.state === 'open' ? 'open' : 'qrcode',
    qrBase64: qr.qrBase64,
    pairingCode: qr.pairingCode,
    count: qr.count,
    instanceName: instance.instance_name,
  });
}

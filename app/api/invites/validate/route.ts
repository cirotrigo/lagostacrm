import { createStaticAdminClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) return json({ valid: false, error: 'Missing token' }, 400);

  const admin = createStaticAdminClient();

  const { data: invite, error } = await admin
    .from('organization_invites')
    .select('token, email, role, expires_at, used_at')
    .eq('token', token)
    .is('used_at', null)
    .maybeSingle();

  if (error) return json({ valid: false, error: error.message }, 500);
  if (!invite) return json({ valid: false, error: 'Invite not found' }, 404);

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return json({ valid: false, error: 'Invite expired' }, 400);
  }

  return json({
    valid: true,
    invite: {
      email: invite.email,
      role: invite.role,
      expires_at: invite.expires_at,
    },
  });
}

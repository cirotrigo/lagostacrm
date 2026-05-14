/**
 * Cron job: auto-reset de handoffs feitos pelo AGENTE após 24h.
 *
 * Roda de hora em hora via Vercel Cron (configurado em vercel.json).
 *
 * Critério para auto-reset:
 * - handoff_source = 'agent'  (foi a Sofia que transferiu, NÃO foi humano)
 * - ai_enabled = false
 * - handoff_at < now() - 24h
 *
 * Handoffs feitos manualmente (handoff_source IN ('ui', 'echo_ig', 'echo_wa'))
 * NUNCA são auto-resetados — o operador humano controla manualmente.
 *
 * Auth: header Authorization: Bearer ${CRON_SECRET} (Vercel envia automaticamente).
 */

import { NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { processHandoff } from '@/lib/messaging/handoff-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TTL_HOURS = 24;

export async function GET(request: Request) {
  // Vercel Cron envia Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const admin = createStaticAdminClient();
  const cutoff = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Pega todas as conversas com handoff agente expirado.
  // Não filtra por organização — roda pra todas (cross-tenant).
  const { data: expired, error } = await admin
    .from('messaging_conversation_links')
    .select('organization_id, chatwoot_conversation_id, handoff_at, handoff_source')
    .eq('ai_enabled', false)
    .eq('handoff_source', 'agent')
    .lt('handoff_at', cutoff)
    .limit(200); // teto de segurança por execução

  if (error) {
    return NextResponse.json({ error: 'Lookup failed', detail: error.message }, { status: 500 });
  }

  const list = expired ?? [];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, expired_before: cutoff });
  }

  const results: Array<{
    organization_id: string;
    conversation_id: number;
    ok: boolean;
    errors?: string[];
  }> = [];

  for (const row of list as Array<{
    organization_id: string;
    chatwoot_conversation_id: number;
  }>) {
    try {
      const r = await processHandoff({
        adminClient: admin,
        organizationId: row.organization_id,
        conversationId: Number(row.chatwoot_conversation_id),
        mode: 'ai',
        source: 'auto_expire',
        reason: `Auto-reset após ${TTL_HOURS}h de handoff pelo agente`,
      });
      results.push({
        organization_id: row.organization_id,
        conversation_id: row.chatwoot_conversation_id,
        ok: r.ok,
        errors: r.errors,
      });
    } catch (e) {
      results.push({
        organization_id: row.organization_id,
        conversation_id: row.chatwoot_conversation_id,
        ok: false,
        errors: [e instanceof Error ? e.message : String(e)],
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: okCount,
    failed: failCount,
    cutoff,
    results,
  });
}

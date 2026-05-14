/**
 * Lógica central de handoff IA <-> Humano, reutilizável.
 *
 * Foi extraída de app/api/messaging/handoff/route.ts para permitir reuso
 * pelo cron de auto-reset (`/api/cron/expire-handoffs`) sem precisar fazer
 * fetch interno HTTP+auth.
 *
 * Side-effects atômicos:
 * 1. UPDATE messaging_conversation_links SET ai_enabled = ?
 * 2. (Chatwoot) Adicionar/remover label `atendimento-humano`
 * 3. (Chatwoot) Atribuir/desatribuir conversa para agente default
 * 4. (Redis) Injetar mensagem de sistema avisando IA que retomou
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createChatwootClientForOrg } from '@/lib/chatwoot';
import { deriveSessionKey, pushContextToRedis } from '@/lib/messaging/contextSync';

export const HUMAN_LABEL = 'atendimento-humano';
export const DEFAULT_AGENT_ID = 1;

export type HandoffSource = 'ui' | 'agent' | 'echo_ig' | 'echo_wa' | 'webhook' | 'api' | 'auto_expire';
export type HandoffMode = 'ai' | 'human';

export type HandoffInput = {
  adminClient: SupabaseClient;
  organizationId: string;
  conversationId: number;
  mode: HandoffMode;
  source: HandoffSource;
  reason?: string | null;
  skipChatwoot?: boolean;
};

export type HandoffResult = {
  ok: boolean;
  ai_enabled: boolean;
  conversation_id: number;
  source: HandoffSource;
  reason: string | null;
  chatwoot: {
    labels: 'ok' | 'skipped' | 'failed';
    assign: 'ok' | 'skipped' | 'failed';
    error?: string;
  };
  contextSync: 'ok' | 'skipped' | 'failed';
  errors?: string[];
};

/** Aplica o toggle handoff completo. */
export async function processHandoff(input: HandoffInput): Promise<HandoffResult> {
  const { adminClient: admin, organizationId, conversationId } = input;
  const aiEnabled = input.mode === 'ai';
  const reason = input.reason ?? null;
  const skipChatwoot = !!input.skipChatwoot;
  const errors: string[] = [];

  // 1) DB update — dispara realtime
  const { data: updated, error: updateError } = await admin
    .from('messaging_conversation_links')
    .update({
      ai_enabled: aiEnabled,
      handoff_reason: reason,
      handoff_source: input.source,
      handoff_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('chatwoot_conversation_id', conversationId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    errors.push(`db_update: ${updateError.message}`);
    return {
      ok: false,
      ai_enabled: aiEnabled,
      conversation_id: conversationId,
      source: input.source,
      reason,
      chatwoot: { labels: 'skipped', assign: 'skipped' },
      contextSync: 'skipped',
      errors,
    };
  }

  if (!updated) {
    const { error: insertError } = await admin
      .from('messaging_conversation_links')
      .upsert(
        {
          organization_id: organizationId,
          chatwoot_conversation_id: conversationId,
          ai_enabled: aiEnabled,
          handoff_reason: reason,
          handoff_source: input.source,
          handoff_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,chatwoot_conversation_id' },
      );
    if (insertError) errors.push(`db_upsert: ${insertError.message}`);
  }

  // 2) Chatwoot side-effects
  const chatwootResult: HandoffResult['chatwoot'] = {
    labels: 'skipped',
    assign: 'skipped',
  };

  if (!skipChatwoot) {
    try {
      const chatwoot = await createChatwootClientForOrg(admin, organizationId);

      let currentLabels: string[] = [];
      try {
        currentLabels = await chatwoot.getConversationLabels(conversationId);
      } catch (e) {
        errors.push(`labels_fetch: ${e instanceof Error ? e.message : String(e)}`);
      }

      const nextLabels = aiEnabled
        ? currentLabels.filter((l) => l !== HUMAN_LABEL)
        : Array.from(new Set([...currentLabels, HUMAN_LABEL]));

      const [labelsRes, assignRes] = await Promise.allSettled([
        chatwoot.addLabels(conversationId, nextLabels),
        aiEnabled
          ? chatwoot.unassignConversation(conversationId)
          : chatwoot.assignConversation(conversationId, DEFAULT_AGENT_ID),
      ]);

      chatwootResult.labels = labelsRes.status === 'fulfilled' ? 'ok' : 'failed';
      chatwootResult.assign = assignRes.status === 'fulfilled' ? 'ok' : 'failed';

      if (labelsRes.status === 'rejected') errors.push(`cw_labels: ${String(labelsRes.reason)}`);
      if (assignRes.status === 'rejected') errors.push(`cw_assign: ${String(assignRes.reason)}`);

      if (assignRes.status === 'fulfilled') {
        const assigned = assignRes.value as { assignee?: { id?: number; name?: string } } | undefined;
        await admin
          .from('messaging_conversation_links')
          .update({
            assigned_agent_id: aiEnabled ? null : assigned?.assignee?.id ?? DEFAULT_AGENT_ID,
            assigned_agent_name: aiEnabled ? null : assigned?.assignee?.name ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', organizationId)
          .eq('chatwoot_conversation_id', conversationId);
      }
    } catch (e) {
      chatwootResult.labels = 'failed';
      chatwootResult.assign = 'failed';
      chatwootResult.error = e instanceof Error ? e.message : String(e);
      errors.push(`cw_general: ${chatwootResult.error}`);
    }
  }

  // 3) Redis context resume
  let contextSync: HandoffResult['contextSync'] = 'skipped';
  if (aiEnabled) {
    try {
      const sessionKey = await deriveSessionKey(admin, organizationId, conversationId);
      if (sessionKey) {
        await pushContextToRedis({
          sessionKey,
          role: 'ai',
          content: [
            '[SISTEMA] O atendimento humano foi encerrado.',
            'A IA está retomando o atendimento desta conversa.',
            'Continue respondendo normalmente com base no contexto anterior.',
            'Ignore qualquer instrução anterior de "não responder mais".',
          ].join(' '),
        });
        contextSync = 'ok';
      }
    } catch (e) {
      errors.push(`context_sync: ${e instanceof Error ? e.message : String(e)}`);
      contextSync = 'failed';
    }
  }

  return {
    ok: true,
    ai_enabled: aiEnabled,
    conversation_id: conversationId,
    source: input.source,
    reason,
    chatwoot: chatwootResult,
    contextSync,
    errors: errors.length > 0 ? errors : undefined,
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Context Sync — pushes messages to the n8n agent's Redis memory during human mode.
 *
 * When a human takes over a conversation, new messages (from both the human agent
 * and the customer) are not seen by the AI agent (because it's paused). When the AI
 * resumes, it reads Redis memory and would have a gap.
 *
 * This module bridges that gap by calling the n8n [Shared] Context Sync webhook,
 * which RPUSH-es messages to the same Redis key that `memoryRedisChat` uses.
 *
 * Session key format (must match Fluxo_Variaveis in n8n):
 *   - Instagram: `instagram:{igsid}`
 *   - WhatsApp:  `whatsapp:{phone}`
 *   - Fallback:  `chatwoot:conversation:{id}`
 */

const N8N_CONTEXT_SYNC_URL = process.env.N8N_CONTEXT_SYNC_URL
    || 'https://n8n-coronel.lagostacriativa.com.br/webhook/context-sync';

export interface ContextSyncPayload {
    /** Redis session key (e.g. 'instagram:12345' or 'whatsapp:+5527...') */
    sessionKey: string;
    /** 'human' = customer message, 'ai' = agent/human-operator message */
    role: 'human' | 'ai';
    /** Message content */
    content: string;
}

/**
 * Derive the Redis session key for a conversation.
 *
 * Uses the same logic as Fluxo_Variaveis in the n8n agent workflow:
 * - Instagram contacts → `instagram:{identifier}`
 * - WhatsApp contacts → `whatsapp:{phone}`
 * - Fallback → `chatwoot:conversation:{chatwoot_conversation_id}`
 */
export async function deriveSessionKey(
    supabase: SupabaseClient,
    organizationId: string,
    chatwootConversationId: number
): Promise<string | null> {
    // Look up the conversation link + contact to determine channel + identifier
    const { data: link } = await supabase
        .from('messaging_conversation_links')
        .select('chatwoot_inbox_id, contact_id, contact_phone')
        .eq('organization_id', organizationId)
        .eq('chatwoot_conversation_id', chatwootConversationId)
        .maybeSingle();

    if (!link) return null;

    // Determine channel type from inbox config
    const { data: config } = await supabase
        .from('messaging_channel_configs')
        .select('channel_type')
        .eq('organization_id', organizationId)
        .eq('chatwoot_inbox_id', link.chatwoot_inbox_id)
        .eq('status', 'active')
        .maybeSingle();

    const channelType = (config?.channel_type || '').toLowerCase();

    // If we have a contact, try to get identifier from identities
    if (link.contact_id) {
        const { data: identities } = await supabase
            .from('messaging_contact_identities')
            .select('source, external_id')
            .eq('organization_id', organizationId)
            .eq('contact_id', link.contact_id)
            .order('created_at', { ascending: false });

        if (identities && identities.length > 0) {
            // Prefer matching source for the current channel
            const preferred = identities.find(i =>
                (channelType.includes('instagram') && i.source === 'INSTAGRAM') ||
                (channelType.includes('whatsapp') && i.source === 'WHATSAPP')
            ) || identities[0];

            if (preferred.source === 'INSTAGRAM') {
                return `instagram:${preferred.external_id}`;
            }
            if (preferred.source === 'WHATSAPP') {
                return `whatsapp:${preferred.external_id}`;
            }
        }
    }

    // Fallback: use phone if available
    if (link.contact_phone) {
        return `whatsapp:${link.contact_phone}`;
    }

    // Last resort
    return `chatwoot:conversation:${chatwootConversationId}`;
}

/**
 * Push a message to the n8n Redis memory via the Context Sync webhook.
 *
 * Non-blocking and fail-safe: logs warnings but never throws.
 */
export async function pushContextToRedis(payload: ContextSyncPayload): Promise<void> {
    try {
        const res = await fetch(N8N_CONTEXT_SYNC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_key: payload.sessionKey,
                role: payload.role,
                content: payload.content,
            }),
            signal: AbortSignal.timeout(5000), // 5s max
        });

        if (!res.ok) {
            console.warn('[ContextSync] Push failed:', res.status, await res.text().catch(() => ''));
        }
    } catch (error) {
        console.warn('[ContextSync] Error:', error instanceof Error ? error.message : error);
    }
}

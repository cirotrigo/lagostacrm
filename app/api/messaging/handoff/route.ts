import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { authPublicApi } from '@/lib/public-api/auth';
import { createChatwootClientForOrg } from '@/lib/chatwoot';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized IA <-> Human handoff endpoint.
 *
 * This is the single source of truth for toggling the AI bot on/off for a
 * conversation. All actors (CRM UI toggle, n8n agent tool, n8n auto-assign
 * workflow, echo detection from Instagram/WhatsApp) route through here.
 *
 * What it does atomically:
 * 1. UPDATE messaging_conversation_links SET ai_enabled = ?  (triggers
 *    supabase_realtime, which instantly updates every connected CRM client)
 * 2. Add/remove `atendimento-humano` label in Chatwoot
 * 3. Assign/unassign the conversation to an agent in Chatwoot
 *
 * Auth:
 * - Cookie session (normal CRM user) OR
 * - X-Api-Key header (n8n workflows and external agents)
 *
 * Response is intentionally fast: the DB update happens first (triggering
 * realtime), then Chatwoot side-effects run in Promise.allSettled so a
 * transient Chatwoot failure doesn't block the UI sync.
 */

const HUMAN_LABEL = 'atendimento-humano';
// Default agent id used for assignment. Matches the value previously hard-coded
// in the useMessagingController toggle.
const DEFAULT_AGENT_ID = 1;

type HandoffSource = 'ui' | 'agent' | 'echo_ig' | 'echo_wa' | 'webhook' | 'api';
type HandoffMode = 'ai' | 'human';

interface HandoffBody {
    conversation_id: number;
    mode: HandoffMode;
    reason?: string;
    source?: HandoffSource;
    /**
     * When true, skip the Chatwoot side-effects (labels + assign).
     * Used by the webhook pipeline when Chatwoot already reflects the state
     * (avoids echo loops).
     */
    skip_chatwoot?: boolean;
}

interface AuthContext {
    supabase: SupabaseClient;
    organizationId: string;
    actor: 'user' | 'api_key';
}

async function resolveAuth(request: NextRequest): Promise<AuthContext | NextResponse> {
    // 1) API key path (preferred for n8n / external callers)
    if (request.headers.get('x-api-key')) {
        const auth = await authPublicApi(request);
        if (!auth.ok) {
            return NextResponse.json(auth.body, { status: auth.status });
        }
        return {
            supabase: createStaticAdminClient(),
            organizationId: auth.organizationId,
            actor: 'api_key',
        };
    }

    // 2) Cookie session path (CRM UI)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    return {
        supabase,
        organizationId: profile.organization_id,
        actor: 'user',
    };
}

/**
 * POST /api/messaging/handoff
 *
 * Body:
 *  {
 *    conversation_id: number,
 *    mode: 'ai' | 'human',
 *    reason?: string,
 *    source?: 'ui' | 'agent' | 'echo_ig' | 'echo_wa' | 'webhook' | 'api',
 *    skip_chatwoot?: boolean
 *  }
 */
export async function POST(request: NextRequest) {
    try {
        const ctx = await resolveAuth(request);
        if (ctx instanceof NextResponse) return ctx;

        let body: HandoffBody;
        try {
            body = await request.json() as HandoffBody;
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const conversationId = Number(body.conversation_id);
        if (!Number.isFinite(conversationId) || conversationId <= 0) {
            return NextResponse.json(
                { error: 'conversation_id is required and must be a positive number' },
                { status: 400 }
            );
        }

        if (body.mode !== 'ai' && body.mode !== 'human') {
            return NextResponse.json(
                { error: 'mode must be "ai" or "human"' },
                { status: 400 }
            );
        }

        const aiEnabled = body.mode === 'ai';
        const source: HandoffSource = body.source ?? (ctx.actor === 'api_key' ? 'agent' : 'ui');
        const skipChatwoot = Boolean(body.skip_chatwoot);

        // 1) Atomic local update — this triggers realtime immediately.
        // Use admin client to bypass any per-row RLS friction for API-key callers.
        const admin = createStaticAdminClient();
        const { data: updated, error: updateError } = await admin
            .from('messaging_conversation_links')
            .update({
                ai_enabled: aiEnabled,
                handoff_reason: body.reason ?? null,
                handoff_source: source,
                handoff_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('organization_id', ctx.organizationId)
            .eq('chatwoot_conversation_id', conversationId)
            .select('id, ai_enabled, handoff_source, handoff_reason, handoff_at')
            .maybeSingle();

        if (updateError) {
            console.error('[handoff] DB update failed:', updateError);
            return NextResponse.json(
                { error: 'Failed to persist handoff state', detail: updateError.message },
                { status: 500 }
            );
        }

        if (!updated) {
            // Conversation link doesn't exist yet (e.g. new conversation that
            // hasn't been synced by webhook). Best-effort: upsert a minimal row
            // so the state is not lost.
            const { error: insertError } = await admin
                .from('messaging_conversation_links')
                .upsert(
                    {
                        organization_id: ctx.organizationId,
                        chatwoot_conversation_id: conversationId,
                        ai_enabled: aiEnabled,
                        handoff_reason: body.reason ?? null,
                        handoff_source: source,
                        handoff_at: new Date().toISOString(),
                    },
                    { onConflict: 'organization_id,chatwoot_conversation_id' }
                );
            if (insertError) {
                console.error('[handoff] DB upsert fallback failed:', insertError);
                return NextResponse.json(
                    { error: 'Failed to create handoff state', detail: insertError.message },
                    { status: 500 }
                );
            }
        }

        // 2) Chatwoot side-effects (labels + assign). Non-blocking for the
        // primary state update, but awaited so the caller knows if it worked.
        const chatwootResult: {
            labels: 'ok' | 'skipped' | 'failed';
            assign: 'ok' | 'skipped' | 'failed';
            error?: string;
        } = {
            labels: 'skipped',
            assign: 'skipped',
        };

        if (!skipChatwoot) {
            try {
                const chatwoot = await createChatwootClientForOrg(admin, ctx.organizationId);

                // Fetch current labels so we only toggle the human label and keep others intact.
                let currentLabels: string[] = [];
                try {
                    currentLabels = await chatwoot.getConversationLabels(conversationId);
                } catch (e) {
                    console.warn('[handoff] Failed to read current labels, defaulting to empty:', e);
                }

                const nextLabels = aiEnabled
                    ? currentLabels.filter(l => l !== HUMAN_LABEL)
                    : Array.from(new Set([...currentLabels, HUMAN_LABEL]));

                // Chatwoot label endpoint is idempotent-ish — it REPLACES labels with the provided list.
                const [labelsRes, assignRes] = await Promise.allSettled([
                    chatwoot.addLabels(conversationId, nextLabels),
                    aiEnabled
                        ? chatwoot.unassignConversation(conversationId)
                        : chatwoot.assignConversation(conversationId, DEFAULT_AGENT_ID),
                ]);

                chatwootResult.labels = labelsRes.status === 'fulfilled' ? 'ok' : 'failed';
                chatwootResult.assign = assignRes.status === 'fulfilled' ? 'ok' : 'failed';

                if (labelsRes.status === 'rejected') {
                    console.error('[handoff] label update failed:', labelsRes.reason);
                    chatwootResult.error = String(labelsRes.reason);
                }
                if (assignRes.status === 'rejected') {
                    console.error('[handoff] assign update failed:', assignRes.reason);
                    chatwootResult.error = chatwootResult.error ?? String(assignRes.reason);
                }

                // Reflect assignment in the link row for UI badges
                if (assignRes.status === 'fulfilled') {
                    const assigned = assignRes.value as { assignee?: { id?: number; name?: string } } | undefined;
                    await admin
                        .from('messaging_conversation_links')
                        .update({
                            assigned_agent_id: aiEnabled ? null : (assigned?.assignee?.id ?? DEFAULT_AGENT_ID),
                            assigned_agent_name: aiEnabled ? null : (assigned?.assignee?.name ?? null),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('organization_id', ctx.organizationId)
                        .eq('chatwoot_conversation_id', conversationId);
                }
            } catch (e) {
                console.error('[handoff] Chatwoot side-effects failed:', e);
                chatwootResult.labels = 'failed';
                chatwootResult.assign = 'failed';
                chatwootResult.error = e instanceof Error ? e.message : String(e);
            }
        }

        return NextResponse.json({
            ok: true,
            ai_enabled: aiEnabled,
            conversation_id: conversationId,
            source,
            reason: body.reason ?? null,
            chatwoot: chatwootResult,
        });
    } catch (error) {
        console.error('[handoff] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/messaging/handoff?conversation_id=123
 *
 * Fast lookup for the current handoff state. Designed to be called by the
 * n8n agent workflow before processing a turn (target < 100ms).
 *
 * Returns:
 *   { ai_enabled: boolean, handoff_source?, handoff_reason?, handoff_at? }
 */
export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveAuth(request);
        if (ctx instanceof NextResponse) return ctx;

        const { searchParams } = new URL(request.url);
        const cidRaw = searchParams.get('conversation_id');
        const conversationId = cidRaw ? Number(cidRaw) : NaN;
        if (!Number.isFinite(conversationId) || conversationId <= 0) {
            return NextResponse.json(
                { error: 'conversation_id query param is required' },
                { status: 400 }
            );
        }

        const admin = createStaticAdminClient();
        const { data, error } = await admin
            .from('messaging_conversation_links')
            .select('ai_enabled, handoff_source, handoff_reason, handoff_at, assigned_agent_id')
            .eq('organization_id', ctx.organizationId)
            .eq('chatwoot_conversation_id', conversationId)
            .maybeSingle();

        if (error) {
            console.error('[handoff] GET failed:', error);
            return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
        }

        // Default to ai_enabled=true when no row exists (new conversation).
        return NextResponse.json({
            ai_enabled: data?.ai_enabled ?? true,
            handoff_source: data?.handoff_source ?? null,
            handoff_reason: data?.handoff_reason ?? null,
            handoff_at: data?.handoff_at ?? null,
            assigned_agent_id: data?.assigned_agent_id ?? null,
        });
    } catch (error) {
        console.error('[handoff] GET unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

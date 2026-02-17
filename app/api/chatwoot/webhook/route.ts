import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import {
    validateWebhookSignature,
    processWebhookEvent,
    getChannelConfig,
    getChannelConfigByInbox,
} from '@/lib/chatwoot';
import type { ChatwootWebhookPayload } from '@/lib/chatwoot';

const CHATWOOT_WEBHOOK_SECRET = process.env.CHATWOOT_WEBHOOK_SECRET;

/**
 * POST /api/chatwoot/webhook
 *
 * Receives webhook events from Chatwoot and syncs with the CRM.
 *
 * Headers:
 * - X-Chatwoot-Signature: Webhook signature (optional if secret not configured)
 * - X-Organization-Id: Organization ID (required)
 *
 * This endpoint is called by Chatwoot when:
 * - A conversation is created
 * - A conversation status changes
 * - A message is created
 * - A contact is created or updated
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Validate signature
        const signature = request.headers.get('X-Chatwoot-Signature') || '';
        const rawBody = await request.text();

        if (CHATWOOT_WEBHOOK_SECRET) {
            const isValid = validateWebhookSignature(
                rawBody,
                signature,
                CHATWOOT_WEBHOOK_SECRET
            );

            if (!isValid) {
                console.error('Invalid Chatwoot webhook signature');
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 401 }
                );
            }
        }

        // 2. Parse payload
        let payload: ChatwootWebhookPayload;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON payload' },
                { status: 400 }
            );
        }

        // 3. Get organization ID
        // Option 1: From header (preferred for multi-tenant)
        let organizationId = request.headers.get('X-Organization-Id');
        const webhookInboxId = payload.inbox?.id ?? payload.conversation?.inbox_id ?? null;
        let resolvedBaseUrl: string | null = null;

        // Option 2: Look up by account ID
        if (!organizationId && payload.account?.id) {
            const supabase = createStaticAdminClient();
            const { data: configs, error: configError } = await supabase
                .from('messaging_channel_configs')
                .select('organization_id, chatwoot_base_url, chatwoot_inbox_id')
                .eq('chatwoot_account_id', payload.account.id)
                .eq('status', 'active');

            if (configError) {
                console.error('Error resolving organization by account_id:', configError);
                return NextResponse.json(
                    { error: 'Failed to resolve organization' },
                    { status: 500 }
                );
            }

            if (configs && configs.length > 0) {
                const inboxScopedConfigs = webhookInboxId == null
                    ? configs
                    : configs.filter(c => c.chatwoot_inbox_id === webhookInboxId);
                const candidates = inboxScopedConfigs.length > 0 ? inboxScopedConfigs : configs;
                const uniqueOrganizationIds = [...new Set(candidates.map(c => c.organization_id))];

                if (uniqueOrganizationIds.length === 1) {
                    const chosenConfig = candidates.find(c => c.organization_id === uniqueOrganizationIds[0]);
                    organizationId = uniqueOrganizationIds[0];
                    resolvedBaseUrl = chosenConfig?.chatwoot_base_url ?? null;
                } else {
                    console.error('Ambiguous organization mapping for Chatwoot account:', {
                        accountId: payload.account.id,
                        inboxId: webhookInboxId,
                        organizations: uniqueOrganizationIds,
                    });
                    return NextResponse.json(
                        { error: 'Ambiguous organization mapping for account' },
                        { status: 400 }
                    );
                }
            }
        }

        if (!organizationId) {
            console.error('Could not determine organization for webhook:', {
                accountId: payload.account?.id,
            });
            return NextResponse.json(
                { error: 'Organization not found' },
                { status: 400 }
            );
        }

        // 4. Get Chatwoot base URL for building deep links
        const supabase = createStaticAdminClient();
        let chatwootBaseUrl = resolvedBaseUrl ?? '';

        if (!chatwootBaseUrl && webhookInboxId != null) {
            const inboxConfig = await getChannelConfigByInbox(supabase, organizationId, webhookInboxId);
            chatwootBaseUrl = inboxConfig?.chatwootBaseUrl ?? '';
        }

        if (!chatwootBaseUrl) {
            const channelConfig = await getChannelConfig(supabase, organizationId);
            chatwootBaseUrl = channelConfig?.chatwootBaseUrl ?? '';
        }

        // 5. Process the webhook event
        await processWebhookEvent(
            supabase,
            organizationId,
            payload,
            chatwootBaseUrl
        );

        // 6. Log the event (optional, for debugging)
        console.log('Chatwoot webhook processed:', {
            event: payload.event,
            organizationId,
            conversationId: payload.conversation?.id,
            messageId: payload.message?.id,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error processing Chatwoot webhook:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/chatwoot/webhook
 *
 * Health check endpoint for webhook configuration.
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Chatwoot webhook endpoint is active',
        secretConfigured: !!CHATWOOT_WEBHOOK_SECRET,
    });
}

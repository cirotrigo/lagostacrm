import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import {
    validateWebhookSignature,
    processWebhookEvent,
    getChannelConfig,
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

        // Option 2: Look up by account ID
        if (!organizationId && payload.account?.id) {
            const supabase = createStaticAdminClient();
            const { data: config } = await supabase
                .from('messaging_channel_configs')
                .select('organization_id')
                .eq('chatwoot_account_id', payload.account.id)
                .eq('status', 'active')
                .single();

            if (config) {
                organizationId = config.organization_id;
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
        const channelConfig = await getChannelConfig(supabase, organizationId);
        const chatwootBaseUrl = channelConfig?.chatwootBaseUrl || '';

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

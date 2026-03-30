import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg, getChannelConfig } from '@/lib/chatwoot';

/**
 * GET /api/chatwoot/debug
 *
 * Debug endpoint to test Chatwoot connection and message retrieval
 *
 * Query params:
 * - conversationId: number (optional - if provided, fetches messages)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const conversationIdStr = searchParams.get('conversationId');

        const supabase = await createClient();

        // Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get org
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization' }, { status: 400 });
        }

        // Get raw config for debugging
        const config = await getChannelConfig(supabase, profile.organization_id);

        if (!config) {
            return NextResponse.json({
                error: 'No Chatwoot configuration found',
                organizationId: profile.organization_id,
            }, { status: 400 });
        }

        // Show config info (mask token)
        const configInfo = {
            baseUrl: config.chatwootBaseUrl,
            accountId: config.chatwootAccountId,
            inboxId: config.chatwootInboxId,
            tokenPreview: config.chatwootApiToken ? `${config.chatwootApiToken.substring(0, 8)}...` : 'NOT SET',
            status: config.status,
        };

        // Test basic connectivity
        let connectionTest = { success: false, error: '', statusCode: 0, url: '' };
        try {
            const testUrl = `${config.chatwootBaseUrl}/api/v1/accounts/${config.chatwootAccountId}/conversations?page=1`;
            connectionTest.url = testUrl;
            const testResponse = await fetch(testUrl, {
                headers: {
                    'api_access_token': config.chatwootApiToken,
                },
            });
            connectionTest = {
                ...connectionTest,
                success: testResponse.ok,
                error: testResponse.ok ? '' : await testResponse.text().catch(() => 'Could not read response'),
                statusCode: testResponse.status,
            };
        } catch (err) {
            connectionTest = {
                ...connectionTest,
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error',
                statusCode: 0,
            };
        }

        // If no conversationId, just return config and connection test
        if (!conversationIdStr) {
            return NextResponse.json({
                success: connectionTest.success,
                config: configInfo,
                connectionTest,
                hint: connectionTest.success
                    ? 'Connection OK! Add ?conversationId=123 to test message fetching'
                    : 'Connection FAILED. Check your Chatwoot URL and API token.',
            });
        }

        const conversationId = parseInt(conversationIdStr, 10);
        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);

        // Fetch messages directly
        const messages = await chatwoot.getMessages(conversationId);

        // Analyze messages
        const analysis = {
            totalMessages: messages.length,
            byType: {
                incoming: messages.filter(m => m.message_type === 'incoming' || m.message_type === 0).length,
                outgoing: messages.filter(m => m.message_type === 'outgoing' || m.message_type === 1).length,
                activity: messages.filter(m => m.message_type === 'activity' || m.message_type === 2).length,
                template: messages.filter(m => m.message_type === 'template' || m.message_type === 3).length,
                unknown: messages.filter(m => !['incoming', 'outgoing', 'activity', 'template', 0, 1, 2, 3].includes(m.message_type as never)).length,
            },
            uniqueMessageTypes: [...new Set(messages.map(m => `${m.message_type} (${typeof m.message_type})`))],
            sampleMessages: messages.slice(0, 10).map(m => ({
                id: m.id,
                message_type: m.message_type,
                message_type_typeof: typeof m.message_type,
                content: m.content?.substring(0, 100),
                sender: m.sender ? {
                    id: m.sender.id,
                    name: m.sender.name,
                    type: 'email' in m.sender ? 'agent' : 'contact',
                } : null,
                private: m.private,
                created_at: new Date(m.created_at * 1000).toISOString(),
            })),
        };

        return NextResponse.json({
            success: true,
            config: configInfo,
            connectionTest,
            conversationId,
            analysis,
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to debug' },
            { status: 500 }
        );
    }
}

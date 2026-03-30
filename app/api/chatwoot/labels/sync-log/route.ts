import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import type { LabelSyncLog } from '@/lib/chatwoot';

/**
 * Database row type for messaging_label_sync_log
 */
interface DbLabelSyncLog {
    id: string;
    organization_id: string;
    deal_id: string | null;
    contact_id: string | null;
    conversation_link_id: string | null;
    action: 'add_label' | 'remove_label' | 'sync_error';
    label_name: string;
    target: 'chatwoot' | 'whatsapp' | 'crm';
    success: boolean;
    error_message: string | null;
    triggered_by: string | null;
    created_at: string;
}

function toLabelSyncLog(row: DbLabelSyncLog): LabelSyncLog {
    return {
        id: row.id,
        organizationId: row.organization_id,
        dealId: row.deal_id ?? undefined,
        contactId: row.contact_id ?? undefined,
        conversationLinkId: row.conversation_link_id ?? undefined,
        action: row.action,
        labelName: row.label_name,
        target: row.target,
        success: row.success,
        errorMessage: row.error_message ?? undefined,
        triggeredBy: row.triggered_by ?? undefined,
        createdAt: row.created_at,
    };
}

/**
 * GET /api/chatwoot/labels/sync-log
 *
 * Get label sync history.
 *
 * Query params:
 * - deal_id: Filter by deal
 * - limit: Number of records (default 50)
 */
export async function GET(request: NextRequest) {
    try {
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

        const { searchParams } = new URL(request.url);
        const dealId = searchParams.get('deal_id');
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        // Build query
        let query = supabase
            .from('messaging_label_sync_log')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 100));

        if (dealId) {
            query = query.eq('deal_id', dealId);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return NextResponse.json({
            data: (data as DbLabelSyncLog[]).map(toLabelSyncLog),
        });
    } catch (error) {
        console.error('Error fetching sync log:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sync log' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/chatwoot/labels/sync-log
 *
 * Log a label sync action (called by n8n).
 *
 * Body:
 * - deal_id: string (optional)
 * - contact_id: string (optional)
 * - conversation_link_id: string (optional)
 * - action: 'add_label' | 'remove_label' | 'sync_error' (required)
 * - label_name: string (required)
 * - target: 'chatwoot' | 'whatsapp' | 'crm' (required)
 * - success: boolean (required)
 * - error_message: string (optional)
 * - triggered_by: string (optional)
 *
 * Headers:
 * - X-Organization-Id: string (required)
 * - Authorization: Bearer <secret> (required)
 */
export async function POST(request: NextRequest) {
    try {
        // Validate auth (n8n uses a shared secret)
        const authHeader = request.headers.get('Authorization');
        const expectedSecret = process.env.N8N_WEBHOOK_SECRET || process.env.CHATWOOT_WEBHOOK_SECRET;

        if (expectedSecret) {
            const providedSecret = authHeader?.replace('Bearer ', '');
            if (providedSecret !== expectedSecret) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // Get organization ID
        const organizationId = request.headers.get('X-Organization-Id');
        if (!organizationId) {
            return NextResponse.json(
                { error: 'X-Organization-Id header required' },
                { status: 400 }
            );
        }

        // Parse body
        const body = await request.json();

        if (!body.action || !body.label_name || !body.target || body.success === undefined) {
            return NextResponse.json(
                { error: 'action, label_name, target, and success are required' },
                { status: 400 }
            );
        }

        // Use admin client (service role) since n8n doesn't have user auth
        const supabase = createStaticAdminClient();

        // Insert log
        const { data, error } = await supabase
            .from('messaging_label_sync_log')
            .insert({
                organization_id: organizationId,
                deal_id: body.deal_id,
                contact_id: body.contact_id,
                conversation_link_id: body.conversation_link_id,
                action: body.action,
                label_name: body.label_name,
                target: body.target,
                success: body.success,
                error_message: body.error_message,
                triggered_by: body.triggered_by || 'n8n',
            })
            .select()
            .single<DbLabelSyncLog>();

        if (error) {
            throw error;
        }

        return NextResponse.json({ data: toLabelSyncLog(data) }, { status: 201 });
    } catch (error) {
        console.error('Error logging label sync:', error);
        return NextResponse.json(
            { error: 'Failed to log label sync' },
            { status: 500 }
        );
    }
}

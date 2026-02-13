import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';
import type { LabelMap } from '@/lib/chatwoot';

/**
 * Database row type for messaging_label_map
 */
interface DbLabelMap {
    id: string;
    organization_id: string;
    crm_tag_name: string;
    chatwoot_label: string;
    whatsapp_label: string | null;
    board_stage_id: string | null;
    color: string;
    sync_to_chatwoot: boolean;
    sync_to_whatsapp: boolean;
    created_at: string;
    updated_at: string;
}

function toLabelMap(row: DbLabelMap): LabelMap {
    return {
        id: row.id,
        organizationId: row.organization_id,
        crmTagName: row.crm_tag_name,
        chatwootLabel: row.chatwoot_label,
        whatsappLabel: row.whatsapp_label ?? undefined,
        boardStageId: row.board_stage_id ?? undefined,
        color: row.color,
        syncToChatwoot: row.sync_to_chatwoot,
        syncToWhatsapp: row.sync_to_whatsapp,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * GET /api/chatwoot/labels
 *
 * List label mappings for the organization.
 *
 * Query params:
 * - stage_id: Filter by board stage ID
 * - source: 'crm' | 'chatwoot' - Get labels from source
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
        const stageId = searchParams.get('stage_id');
        const source = searchParams.get('source');

        // If requesting Chatwoot labels directly
        if (source === 'chatwoot') {
            try {
                const chatwoot = await createChatwootClientForOrg(
                    supabase,
                    profile.organization_id
                );
                const labels = await chatwoot.getLabels();
                return NextResponse.json({ data: labels, source: 'chatwoot' });
            } catch {
                return NextResponse.json(
                    { error: 'Chatwoot not configured' },
                    { status: 404 }
                );
            }
        }

        // Get label mappings from database
        let query = supabase
            .from('messaging_label_map')
            .select('*')
            .eq('organization_id', profile.organization_id);

        if (stageId) {
            query = query.eq('board_stage_id', stageId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json({
            data: (data as DbLabelMap[]).map(toLabelMap),
        });
    } catch (error) {
        console.error('Error fetching labels:', error);
        return NextResponse.json(
            { error: 'Failed to fetch labels' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/chatwoot/labels
 *
 * Create a new label mapping.
 *
 * Body:
 * - crm_tag_name: string (required)
 * - chatwoot_label: string (required)
 * - whatsapp_label: string (optional)
 * - board_stage_id: string (optional)
 * - color: string (optional)
 * - sync_to_chatwoot: boolean (optional, default true)
 * - sync_to_whatsapp: boolean (optional, default true)
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get org and check admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization' }, { status: 400 });
        }

        if (profile.role !== 'admin') {
            return NextResponse.json({ error: 'Admin required' }, { status: 403 });
        }

        // Parse body
        const body = await request.json();

        if (!body.crm_tag_name || !body.chatwoot_label) {
            return NextResponse.json(
                { error: 'crm_tag_name and chatwoot_label are required' },
                { status: 400 }
            );
        }

        // Create mapping
        const { data, error } = await supabase
            .from('messaging_label_map')
            .insert({
                organization_id: profile.organization_id,
                crm_tag_name: body.crm_tag_name,
                chatwoot_label: body.chatwoot_label,
                whatsapp_label: body.whatsapp_label,
                board_stage_id: body.board_stage_id,
                color: body.color || '#6B7280',
                sync_to_chatwoot: body.sync_to_chatwoot ?? true,
                sync_to_whatsapp: body.sync_to_whatsapp ?? true,
            })
            .select()
            .single<DbLabelMap>();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'Label mapping already exists' },
                    { status: 409 }
                );
            }
            throw error;
        }

        // Optionally create the label in Chatwoot
        if (body.create_in_chatwoot) {
            try {
                const chatwoot = await createChatwootClientForOrg(
                    supabase,
                    profile.organization_id
                );
                await chatwoot.createLabel(
                    body.chatwoot_label,
                    `CRM Tag: ${body.crm_tag_name}`,
                    body.color
                );
            } catch {
                // Ignore if label already exists in Chatwoot
            }
        }

        return NextResponse.json({ data: toLabelMap(data) }, { status: 201 });
    } catch (error) {
        console.error('Error creating label mapping:', error);
        return NextResponse.json(
            { error: 'Failed to create label mapping' },
            { status: 500 }
        );
    }
}

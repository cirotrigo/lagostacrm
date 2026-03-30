import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

/**
 * GET /api/messaging/agents
 *
 * Get all agents (team members) available for assignment
 *
 * Query params:
 * - inbox_id: Filter agents by inbox (optional)
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

        const chatwoot = await createChatwootClientForOrg(supabase, profile.organization_id);

        // Check for inbox_id filter
        const searchParams = request.nextUrl.searchParams;
        const inboxId = searchParams.get('inbox_id');

        let agents;
        if (inboxId) {
            // Get agents for specific inbox
            agents = await chatwoot.getInboxAgents(parseInt(inboxId, 10));
        } else {
            // Get all agents
            agents = await chatwoot.getAgents();
        }

        // Also sync agents to local cache for future reference
        for (const agent of agents) {
            await supabase
                .from('messaging_agents')
                .upsert({
                    organization_id: profile.organization_id,
                    chatwoot_agent_id: agent.id,
                    chatwoot_agent_name: agent.name,
                    chatwoot_agent_email: agent.email,
                    availability: agent.availability_status || 'offline',
                    last_seen_at: new Date().toISOString(),
                }, {
                    onConflict: 'organization_id,chatwoot_agent_id',
                });
        }

        return NextResponse.json({
            data: agents,
            meta: {
                organizationId: profile.organization_id,
                count: agents.length,
            },
        });
    } catch (error) {
        console.error('Error fetching agents:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agents' },
            { status: 500 }
        );
    }
}

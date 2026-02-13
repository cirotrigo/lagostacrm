import type { SupabaseClient } from '@supabase/supabase-js';
import { ChatwootClient } from './client';
import type { ChatwootChannelConfig } from './types';

/**
 * Database row type for messaging_channel_configs
 */
interface DbChannelConfig {
    id: string;
    organization_id: string;
    chatwoot_base_url: string;
    chatwoot_api_token: string;
    chatwoot_account_id: number;
    chatwoot_inbox_id: number | null;
    wppconnect_base_url: string | null;
    wppconnect_token: string | null;
    wppconnect_session: string | null;
    channel_type: string;
    name: string;
    status: 'active' | 'inactive' | 'error';
    created_at: string;
    updated_at: string;
}

/**
 * Transform database row to application type
 */
function toChannelConfig(row: DbChannelConfig): ChatwootChannelConfig {
    return {
        id: row.id,
        organizationId: row.organization_id,
        chatwootBaseUrl: row.chatwoot_base_url,
        chatwootApiToken: row.chatwoot_api_token,
        chatwootAccountId: row.chatwoot_account_id,
        chatwootInboxId: row.chatwoot_inbox_id ?? undefined,
        wppconnectBaseUrl: row.wppconnect_base_url ?? undefined,
        wppconnectToken: row.wppconnect_token ?? undefined,
        wppconnectSession: row.wppconnect_session ?? undefined,
        channelType: row.channel_type,
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Get active Chatwoot configuration for an organization
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization ID
 * @returns Active channel configuration or null
 */
export async function getChannelConfig(
    supabase: SupabaseClient,
    organizationId: string
): Promise<ChatwootChannelConfig | null> {
    const { data, error } = await supabase
        .from('messaging_channel_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .single<DbChannelConfig>();

    if (error || !data) {
        return null;
    }

    return toChannelConfig(data);
}

/**
 * Get all channel configurations for an organization
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization ID
 * @returns Array of channel configurations
 */
export async function getAllChannelConfigs(
    supabase: SupabaseClient,
    organizationId: string
): Promise<ChatwootChannelConfig[]> {
    const { data, error } = await supabase
        .from('messaging_channel_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (error || !data) {
        return [];
    }

    return data.map(toChannelConfig);
}

/**
 * Create a Chatwoot client for an organization
 *
 * Fetches the active configuration from the database and returns a configured client.
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization ID
 * @returns Configured ChatwootClient
 * @throws Error if no active configuration found
 *
 * @example
 * ```typescript
 * const supabase = await createClient();
 * const chatwoot = await createChatwootClientForOrg(supabase, orgId);
 * const conversations = await chatwoot.getConversations();
 * ```
 */
export async function createChatwootClientForOrg(
    supabase: SupabaseClient,
    organizationId: string
): Promise<ChatwootClient> {
    const config = await getChannelConfig(supabase, organizationId);

    if (!config) {
        throw new Error('No active Chatwoot configuration found for organization');
    }

    return new ChatwootClient({
        baseUrl: config.chatwootBaseUrl,
        token: config.chatwootApiToken,
        accountId: config.chatwootAccountId,
    });
}

/**
 * Create a Chatwoot client from environment variables (fallback/dev)
 *
 * Uses CHATWOOT_* environment variables when database config is not available.
 *
 * @returns Configured ChatwootClient
 * @throws Error if required environment variables are missing
 */
export function createChatwootClientFromEnv(): ChatwootClient {
    const baseUrl = process.env.CHATWOOT_BASE_URL;
    const token = process.env.CHATWOOT_API_TOKEN;
    const accountId = process.env.CHATWOOT_ACCOUNT_ID;

    if (!baseUrl || !token || !accountId) {
        throw new Error(
            'Missing Chatwoot environment variables: CHATWOOT_BASE_URL, CHATWOOT_API_TOKEN, CHATWOOT_ACCOUNT_ID'
        );
    }

    return new ChatwootClient({
        baseUrl,
        token,
        accountId: parseInt(accountId, 10),
    });
}

/**
 * Save or update a channel configuration
 *
 * @param supabase - Supabase client (must have admin privileges)
 * @param config - Channel configuration to save
 * @returns Saved configuration
 */
export async function saveChannelConfig(
    supabase: SupabaseClient,
    config: Omit<ChatwootChannelConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ChatwootChannelConfig> {
    const { data, error } = await supabase
        .from('messaging_channel_configs')
        .upsert({
            organization_id: config.organizationId,
            chatwoot_base_url: config.chatwootBaseUrl,
            chatwoot_api_token: config.chatwootApiToken,
            chatwoot_account_id: config.chatwootAccountId,
            chatwoot_inbox_id: config.chatwootInboxId,
            wppconnect_base_url: config.wppconnectBaseUrl,
            wppconnect_token: config.wppconnectToken,
            wppconnect_session: config.wppconnectSession,
            channel_type: config.channelType,
            name: config.name,
            status: config.status,
        }, {
            onConflict: 'organization_id',
        })
        .select()
        .single<DbChannelConfig>();

    if (error || !data) {
        throw new Error(`Failed to save channel config: ${error?.message}`);
    }

    return toChannelConfig(data);
}

/**
 * Update channel config status
 *
 * @param supabase - Supabase client
 * @param configId - Configuration ID
 * @param status - New status
 */
export async function updateChannelStatus(
    supabase: SupabaseClient,
    configId: string,
    status: 'active' | 'inactive' | 'error'
): Promise<void> {
    const { error } = await supabase
        .from('messaging_channel_configs')
        .update({ status })
        .eq('id', configId);

    if (error) {
        throw new Error(`Failed to update channel status: ${error.message}`);
    }
}

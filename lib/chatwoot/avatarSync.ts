import type { SupabaseClient } from '@supabase/supabase-js';
import { ChatwootClient } from './client';
import type { ChatwootContact } from './types';

const DEFAULT_BATCH_SIZE = 100;
const PAGE_SIZE = 1000;

interface ChannelConfigRow {
    organization_id: string;
    chatwoot_base_url: string;
    chatwoot_api_token: string;
    chatwoot_account_id: number;
    updated_at: string;
}

interface ContactRow {
    id: string;
    name: string | null;
    phone: string | null;
    avatar: string | null;
}

interface ContactIdentityRow {
    contact_id: string;
    source: string;
    external_id: string;
}

interface LinkAvatarRow {
    contact_id: string | null;
    contact_avatar_url: string | null;
}

interface OrganizationChatwootConfig {
    organizationId: string;
    chatwootBaseUrl: string;
    chatwootApiToken: string;
    chatwootAccountId: number;
}

interface SyncFromChatwootResult {
    searched: number;
    matched: number;
    updatedFromChatwoot: number;
    noMatch: number;
    noThumbnail: number;
    errors: number;
}

export interface AvatarSyncOptions {
    organizationId?: string;
    dryRun?: boolean;
    verbose?: boolean;
    batchSize?: number;
}

export interface AvatarSyncOrganizationStats {
    organizationId: string;
    missingAtStart: number;
    fromLinksUpdated: number;
    searched: number;
    matched: number;
    updatedFromChatwoot: number;
    noMatch: number;
    noThumbnail: number;
    errors: number;
    missingAtEnd: number;
}

export interface AvatarSyncTotals {
    missingAtStart: number;
    fromLinksUpdated: number;
    searched: number;
    matched: number;
    updatedFromChatwoot: number;
    noMatch: number;
    noThumbnail: number;
    errors: number;
    missingAtEnd: number;
}

export interface AvatarSyncSummary {
    dryRun: boolean;
    startedAt: string;
    finishedAt: string;
    organizations: number;
    totals: AvatarSyncTotals;
    byOrg: AvatarSyncOrganizationStats[];
}

function normalizePhoneE164(input: string | null | undefined): string | null {
    if (!input) return null;

    const cleaned = input.trim().replace(/[\s\-().]/g, '');
    if (!cleaned) return null;

    if (cleaned.startsWith('+')) {
        return /^\+[1-9]\d{1,14}$/.test(cleaned) ? cleaned : null;
    }

    if (/^[1-9]\d{10,14}$/.test(cleaned)) return `+${cleaned}`;
    if (/^\d{10,11}$/.test(cleaned)) return `+55${cleaned}`;

    return null;
}

function pickBestChatwootMatch(
    source: string,
    externalId: string,
    results: ChatwootContact[]
): ChatwootContact | null {
    if (!results.length) return null;

    if (source === 'WHATSAPP') {
        const targetPhone = normalizePhoneE164(externalId);
        if (targetPhone) {
            const exactPhoneMatch = results.find((result) => {
                const candidate = normalizePhoneE164(result.phone_number);
                return candidate === targetPhone;
            });

            if (exactPhoneMatch) return exactPhoneMatch;
        }
    }

    if (source === 'INSTAGRAM') {
        const targetIdentifier = externalId.trim();
        if (targetIdentifier) {
            const exactIdentifierMatch = results.find((result) => {
                return (result.identifier || '').trim() === targetIdentifier;
            });

            if (exactIdentifierMatch) return exactIdentifierMatch;
        }
    }

    const withThumbnail = results.find((result) => (result.thumbnail || '').trim().length > 0);
    return withThumbnail || results[0] || null;
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < array.length; index += size) {
        chunks.push(array.slice(index, index + size));
    }
    return chunks;
}

function createEmptyTotals(): AvatarSyncTotals {
    return {
        missingAtStart: 0,
        fromLinksUpdated: 0,
        searched: 0,
        matched: 0,
        updatedFromChatwoot: 0,
        noMatch: 0,
        noThumbnail: 0,
        errors: 0,
        missingAtEnd: 0,
    };
}

async function countMissingAvatars(
    supabase: SupabaseClient,
    organizationId: string
): Promise<number> {
    const { count, error } = await supabase
        .from('contacts')
        .select('id', { head: true, count: 'exact' })
        .eq('organization_id', organizationId)
        .or('avatar.is.null,avatar.eq.');

    if (error) {
        throw new Error(`Failed counting contacts without avatar: ${error.message}`);
    }

    return count || 0;
}

async function getActiveOrganizationConfigs(
    supabase: SupabaseClient,
    organizationId?: string
): Promise<OrganizationChatwootConfig[]> {
    let query = supabase
        .from('messaging_channel_configs')
        .select('organization_id,chatwoot_base_url,chatwoot_api_token,chatwoot_account_id,updated_at')
        .eq('status', 'active')
        .order('organization_id', { ascending: true })
        .order('updated_at', { ascending: false });

    if (organizationId) {
        query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed loading Chatwoot channel configs: ${error.message}`);
    }

    const newestByOrg = new Map<string, OrganizationChatwootConfig>();
    for (const row of (data || []) as ChannelConfigRow[]) {
        if (newestByOrg.has(row.organization_id)) continue;

        newestByOrg.set(row.organization_id, {
            organizationId: row.organization_id,
            chatwootBaseUrl: row.chatwoot_base_url,
            chatwootApiToken: row.chatwoot_api_token,
            chatwootAccountId: row.chatwoot_account_id,
        });
    }

    return [...newestByOrg.values()];
}

async function getConversationLinksWithAvatar(
    supabase: SupabaseClient,
    organizationId: string
): Promise<LinkAvatarRow[]> {
    const rows: LinkAvatarRow[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('messaging_conversation_links')
            .select('contact_id,contact_avatar_url')
            .eq('organization_id', organizationId)
            .not('contact_id', 'is', null)
            .not('contact_avatar_url', 'is', null)
            .order('updated_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            throw new Error(`Failed loading conversation links: ${error.message}`);
        }

        const page = (data || []) as LinkAvatarRow[];
        if (!page.length) break;

        rows.push(...page);

        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return rows;
}

async function getContactsWithoutAvatar(
    supabase: SupabaseClient,
    organizationId: string
): Promise<ContactRow[]> {
    const rows: ContactRow[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('contacts')
            .select('id,name,phone,avatar')
            .eq('organization_id', organizationId)
            .or('avatar.is.null,avatar.eq.')
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            throw new Error(`Failed loading contacts without avatar: ${error.message}`);
        }

        const page = (data || []) as ContactRow[];
        if (!page.length) break;

        rows.push(...page);

        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return rows;
}

async function syncFromConversationLinks(
    supabase: SupabaseClient,
    organizationId: string,
    dryRun: boolean,
    batchSize: number
): Promise<number> {
    const links = await getConversationLinksWithAvatar(supabase, organizationId);
    if (!links.length) return 0;

    const avatarByContact = new Map<string, string>();

    for (const row of links) {
        const contactId = (row.contact_id || '').trim();
        const avatar = (row.contact_avatar_url || '').trim();

        if (!contactId || !avatar) continue;
        if (!avatarByContact.has(contactId)) {
            avatarByContact.set(contactId, avatar);
        }
    }

    if (!avatarByContact.size) return 0;

    let updated = 0;
    const contactIds = [...avatarByContact.keys()];

    for (const idsChunk of chunkArray(contactIds, batchSize)) {
        const { data: contacts, error: contactsError } = await supabase
            .from('contacts')
            .select('id,avatar')
            .eq('organization_id', organizationId)
            .in('id', idsChunk)
            .or('avatar.is.null,avatar.eq.');

        if (contactsError) {
            throw new Error(`Failed loading contacts for link sync: ${contactsError.message}`);
        }

        for (const contact of (contacts || []) as Array<{ id: string; avatar: string | null }>) {
            const avatar = avatarByContact.get(contact.id);
            if (!avatar) continue;

            if (dryRun) {
                updated += 1;
                continue;
            }

            const { error: updateError } = await supabase
                .from('contacts')
                .update({ avatar, updated_at: new Date().toISOString() })
                .eq('organization_id', organizationId)
                .eq('id', contact.id)
                .or('avatar.is.null,avatar.eq.');

            if (!updateError) {
                updated += 1;
            }
        }
    }

    return updated;
}

async function loadIdentitiesByContact(
    supabase: SupabaseClient,
    organizationId: string,
    contactIds: string[],
    batchSize: number
): Promise<Map<string, ContactIdentityRow[]>> {
    const identitiesByContact = new Map<string, ContactIdentityRow[]>();

    for (const idsChunk of chunkArray(contactIds, batchSize)) {
        const { data, error } = await supabase
            .from('messaging_contact_identities')
            .select('contact_id,source,external_id')
            .eq('organization_id', organizationId)
            .in('contact_id', idsChunk);

        if (error) {
            throw new Error(`Failed loading contact identities: ${error.message}`);
        }

        for (const identity of (data || []) as ContactIdentityRow[]) {
            const current = identitiesByContact.get(identity.contact_id) || [];
            current.push(identity);
            identitiesByContact.set(identity.contact_id, current);
        }
    }

    return identitiesByContact;
}

async function syncFromChatwootSearch(
    supabase: SupabaseClient,
    config: OrganizationChatwootConfig,
    dryRun: boolean,
    verbose: boolean,
    batchSize: number
): Promise<SyncFromChatwootResult> {
    const result: SyncFromChatwootResult = {
        searched: 0,
        matched: 0,
        updatedFromChatwoot: 0,
        noMatch: 0,
        noThumbnail: 0,
        errors: 0,
    };

    const contacts = await getContactsWithoutAvatar(supabase, config.organizationId);
    if (!contacts.length) return result;

    const contactIds = contacts.map((contact) => contact.id);
    const identitiesByContact = await loadIdentitiesByContact(
        supabase,
        config.organizationId,
        contactIds,
        batchSize
    );

    const chatwoot = new ChatwootClient({
        baseUrl: config.chatwootBaseUrl,
        token: config.chatwootApiToken,
        accountId: config.chatwootAccountId,
    });

    for (const contact of contacts) {
        const candidateKeys = new Set<string>();
        const candidates: Array<{ source: string; externalId: string }> = [];

        for (const identity of identitiesByContact.get(contact.id) || []) {
            const externalId = (identity.external_id || '').trim();
            if (!externalId) continue;

            const key = `${identity.source}:${externalId}`;
            if (candidateKeys.has(key)) continue;

            candidateKeys.add(key);
            candidates.push({
                source: identity.source,
                externalId,
            });
        }

        const normalizedPhone = normalizePhoneE164(contact.phone);
        if (normalizedPhone) {
            const phoneKey = `WHATSAPP:${normalizedPhone}`;
            if (!candidateKeys.has(phoneKey)) {
                candidateKeys.add(phoneKey);
                candidates.push({ source: 'WHATSAPP', externalId: normalizedPhone });
            }
        }

        let match: ChatwootContact | null = null;

        for (const candidate of candidates) {
            try {
                result.searched += 1;
                const response = await chatwoot.searchContacts(candidate.externalId);
                match = pickBestChatwootMatch(candidate.source, candidate.externalId, response);
                if (match) break;
            } catch {
                result.errors += 1;
            }
        }

        if (!match) {
            result.noMatch += 1;
            if (verbose) {
                console.log(`[avatar-sync] No match for contact ${contact.id}`);
            }
            continue;
        }

        result.matched += 1;

        const thumbnail = (match.thumbnail || '').trim();
        if (!thumbnail) {
            result.noThumbnail += 1;
            if (verbose) {
                console.log(`[avatar-sync] Match without thumbnail for contact ${contact.id}`);
            }
            continue;
        }

        if (dryRun) {
            result.updatedFromChatwoot += 1;
            continue;
        }

        const { error: updateError } = await supabase
            .from('contacts')
            .update({ avatar: thumbnail, updated_at: new Date().toISOString() })
            .eq('organization_id', config.organizationId)
            .eq('id', contact.id)
            .or('avatar.is.null,avatar.eq.');

        if (updateError) {
            result.errors += 1;
            continue;
        }

        result.updatedFromChatwoot += 1;
    }

    return result;
}

export async function syncChatwootContactAvatars(
    supabase: SupabaseClient,
    options: AvatarSyncOptions = {}
): Promise<AvatarSyncSummary> {
    const startedAt = new Date().toISOString();
    const dryRun = options.dryRun === true;
    const verbose = options.verbose === true;
    const batchSize = Math.max(10, options.batchSize || DEFAULT_BATCH_SIZE);

    const configs = await getActiveOrganizationConfigs(supabase, options.organizationId);
    const byOrg: AvatarSyncOrganizationStats[] = [];

    for (const config of configs) {
        const stats: AvatarSyncOrganizationStats = {
            organizationId: config.organizationId,
            missingAtStart: 0,
            fromLinksUpdated: 0,
            searched: 0,
            matched: 0,
            updatedFromChatwoot: 0,
            noMatch: 0,
            noThumbnail: 0,
            errors: 0,
            missingAtEnd: 0,
        };

        try {
            stats.missingAtStart = await countMissingAvatars(supabase, config.organizationId);

            if (stats.missingAtStart > 0) {
                stats.fromLinksUpdated = await syncFromConversationLinks(
                    supabase,
                    config.organizationId,
                    dryRun,
                    batchSize
                );

                const chatwootStats = await syncFromChatwootSearch(
                    supabase,
                    config,
                    dryRun,
                    verbose,
                    batchSize
                );

                stats.searched = chatwootStats.searched;
                stats.matched = chatwootStats.matched;
                stats.updatedFromChatwoot = chatwootStats.updatedFromChatwoot;
                stats.noMatch = chatwootStats.noMatch;
                stats.noThumbnail = chatwootStats.noThumbnail;
                stats.errors = chatwootStats.errors;
            }

            if (dryRun) {
                stats.missingAtEnd = Math.max(
                    stats.missingAtStart - stats.fromLinksUpdated - stats.updatedFromChatwoot,
                    0
                );
            } else {
                stats.missingAtEnd = await countMissingAvatars(supabase, config.organizationId);
            }
        } catch (error) {
            stats.errors += 1;
            if (verbose) {
                console.error(
                    `[avatar-sync] Failed processing organization ${config.organizationId}:`,
                    error
                );
            }
        }

        byOrg.push(stats);
    }

    const totals = byOrg.reduce<AvatarSyncTotals>((acc, item) => {
        acc.missingAtStart += item.missingAtStart;
        acc.fromLinksUpdated += item.fromLinksUpdated;
        acc.searched += item.searched;
        acc.matched += item.matched;
        acc.updatedFromChatwoot += item.updatedFromChatwoot;
        acc.noMatch += item.noMatch;
        acc.noThumbnail += item.noThumbnail;
        acc.errors += item.errors;
        acc.missingAtEnd += item.missingAtEnd;
        return acc;
    }, createEmptyTotals());

    return {
        dryRun,
        startedAt,
        finishedAt: new Date().toISOString(),
        organizations: byOrg.length,
        totals,
        byOrg,
    };
}

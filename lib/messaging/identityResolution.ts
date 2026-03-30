/**
 * @fileoverview Identity resolution service for multi-channel messaging.
 *
 * Resolves contacts by external channel identity with fallback to phone/email.
 * Creates/updates identity mappings in messaging_contact_identities table.
 *
 * Resolution Priority:
 * 1. Exact match in messaging_contact_identities table
 * 2. Fallback to phone lookup (if phone provided)
 * 3. Fallback to email lookup (if email provided)
 * 4. Auto-create contact (if autoCreate enabled)
 *
 * @module lib/messaging/identityResolution
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
    type MessagingSource,
    buildIdentityKey,
} from './identityKey';
import { normalizePhoneE164 } from '@/lib/phone';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a successful identity resolution.
 */
export interface ResolvedIdentity {
    /** CRM contact ID */
    contactId: string;
    /** Identity mapping ID (null if resolved via fallback) */
    identityId: string | null;
    /** Channel source */
    source: MessagingSource;
    /** Normalized external identifier */
    externalId: string;
    /** How the identity was resolved */
    resolutionMethod: 'identity' | 'phone' | 'email' | 'created';
}

/**
 * Options for identity resolution.
 */
export interface ResolveIdentityOptions {
    /** Organization ID (required for multi-tenant isolation) */
    organizationId: string;
    /** Channel source (WHATSAPP or INSTAGRAM) */
    source: MessagingSource;
    /** External identifier from the messaging platform */
    externalId: string;

    // Fallback identifiers (optional)
    /** Phone number for fallback lookup */
    phone?: string | null;
    /** Email for fallback lookup */
    email?: string | null;

    // Contact creation data (if auto-create enabled)
    /** Contact name for auto-creation */
    contactName?: string | null;
    /** Contact avatar URL for auto-creation */
    contactAvatar?: string | null;

    // Behavior flags
    /** Create contact if not found (default: false) */
    autoCreate?: boolean;
    /** Create identity mapping if resolved via fallback (default: true) */
    createIdentity?: boolean;
}

/**
 * Result of identity resolution operation.
 */
export type ResolveIdentityResult =
    | { ok: true; data: ResolvedIdentity }
    | { ok: false; error: string; code: ResolveIdentityErrorCode };

/**
 * Error codes for identity resolution failures.
 */
export type ResolveIdentityErrorCode =
    | 'NOT_FOUND'
    | 'AMBIGUOUS'
    | 'INVALID_INPUT'
    | 'DB_ERROR';

type ResolutionLogAction =
    | 'created'
    | 'matched'
    | 'fallback_phone'
    | 'fallback_email'
    | 'ambiguous'
    | 'not_found'
    | 'error';

// ============================================================================
// Database Types
// ============================================================================

interface DbContactIdentity {
    id: string;
    organization_id: string;
    contact_id: string;
    source: string;
    external_id: string;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve a contact by external channel identity.
 *
 * Resolution priority:
 * 1. Exact match in messaging_contact_identities
 * 2. Fallback to phone lookup (if phone provided)
 * 3. Fallback to email lookup (if email provided)
 * 4. Auto-create contact (if autoCreate enabled)
 *
 * @param supabase - Supabase admin client
 * @param options - Resolution options
 * @returns Resolution result
 *
 * @example
 * ```typescript
 * const result = await resolveContactByIdentity(supabase, {
 *     organizationId: 'org-uuid',
 *     source: 'INSTAGRAM',
 *     externalId: '17841400000000000',
 *     contactName: 'John Doe',
 *     autoCreate: true,
 * });
 *
 * if (result.ok) {
 *     console.log('Resolved contact:', result.data.contactId);
 *     console.log('Method:', result.data.resolutionMethod);
 * }
 * ```
 */
export async function resolveContactByIdentity(
    supabase: SupabaseClient,
    options: ResolveIdentityOptions
): Promise<ResolveIdentityResult> {
    const {
        organizationId,
        source,
        externalId,
        phone,
        email,
        contactName,
        contactAvatar,
        autoCreate = false,
        createIdentity = true,
    } = options;

    // Validate inputs
    const canonicalKey = buildIdentityKey(source, externalId);
    if (!canonicalKey) {
        await logIdentityResolution(supabase, {
            organizationId,
            source,
            externalId,
            action: 'error',
            errorMessage: `Invalid external_id "${externalId}" for source ${source}`,
            metadata: { reason: 'invalid_input' },
        });
        return {
            ok: false,
            error: `Invalid external_id "${externalId}" for source ${source}`,
            code: 'INVALID_INPUT',
        };
    }

    // Extract normalized external_id from canonical key
    const normalizedExternalId = canonicalKey.split(':')[1];

    // Step 1: Try exact match in messaging_contact_identities
    const { data: existingIdentity, error: identityError } = await supabase
        .from('messaging_contact_identities')
        .select('id, contact_id')
        .eq('organization_id', organizationId)
        .eq('source', source)
        .eq('external_id', normalizedExternalId)
        .maybeSingle();

    if (identityError) {
        console.error('[Identity] DB error during identity lookup:', identityError);
        await logIdentityResolution(supabase, {
            organizationId,
            source,
            externalId: normalizedExternalId,
            action: 'error',
            errorMessage: identityError.message,
            metadata: { stage: 'identity_lookup' },
        });
        return { ok: false, error: identityError.message, code: 'DB_ERROR' };
    }

    if (existingIdentity) {
        console.log('[Identity] Resolved via identity table:', {
            contactId: existingIdentity.contact_id,
            identityId: existingIdentity.id,
        });
        await logIdentityResolution(supabase, {
            organizationId,
            source,
            externalId: normalizedExternalId,
            action: 'matched',
            contactId: existingIdentity.contact_id,
            identityId: existingIdentity.id,
        });
        return {
            ok: true,
            data: {
                contactId: existingIdentity.contact_id,
                identityId: existingIdentity.id,
                source,
                externalId: normalizedExternalId,
                resolutionMethod: 'identity',
            },
        };
    }

    // Step 2: Fallback to phone lookup
    const normalizedPhone = phone ? normalizePhoneE164(phone) : null;
    if (normalizedPhone && normalizedPhone.length >= 8) {
        const { data: phoneContact, error: phoneError } = await supabase
            .from('contacts')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('phone', normalizedPhone)
            .is('deleted_at', null)
            .maybeSingle();

        if (phoneError) {
            console.error('[Identity] DB error during phone lookup:', phoneError);
            await logIdentityResolution(supabase, {
                organizationId,
                source,
                externalId: normalizedExternalId,
                action: 'error',
                errorMessage: phoneError.message,
                metadata: { stage: 'phone_lookup' },
            });
            return { ok: false, error: phoneError.message, code: 'DB_ERROR' };
        }

        if (phoneContact) {
            console.log('[Identity] Resolved via phone fallback:', {
                contactId: phoneContact.id,
                phone: normalizedPhone,
            });

            // Optionally create identity mapping for future lookups
            let identityId: string | null = null;
            if (createIdentity) {
                identityId = await createIdentityMapping(
                    supabase,
                    organizationId,
                    phoneContact.id,
                    source,
                    normalizedExternalId
                );
            }
            await logIdentityResolution(supabase, {
                organizationId,
                source,
                externalId: normalizedExternalId,
                action: 'fallback_phone',
                contactId: phoneContact.id,
                identityId,
                metadata: { phone: normalizedPhone },
            });

            return {
                ok: true,
                data: {
                    contactId: phoneContact.id,
                    identityId,
                    source,
                    externalId: normalizedExternalId,
                    resolutionMethod: 'phone',
                },
            };
        }
    }

    // Step 3: Fallback to email lookup
    const normalizedEmail = email?.trim().toLowerCase() || null;
    if (normalizedEmail) {
        const { data: emailContact, error: emailError } = await supabase
            .from('contacts')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('email', normalizedEmail)
            .is('deleted_at', null)
            .maybeSingle();

        if (emailError) {
            console.error('[Identity] DB error during email lookup:', emailError);
            await logIdentityResolution(supabase, {
                organizationId,
                source,
                externalId: normalizedExternalId,
                action: 'error',
                errorMessage: emailError.message,
                metadata: { stage: 'email_lookup' },
            });
            return { ok: false, error: emailError.message, code: 'DB_ERROR' };
        }

        if (emailContact) {
            console.log('[Identity] Resolved via email fallback:', {
                contactId: emailContact.id,
                email: normalizedEmail,
            });

            // Optionally create identity mapping for future lookups
            let identityId: string | null = null;
            if (createIdentity) {
                identityId = await createIdentityMapping(
                    supabase,
                    organizationId,
                    emailContact.id,
                    source,
                    normalizedExternalId
                );
            }
            await logIdentityResolution(supabase, {
                organizationId,
                source,
                externalId: normalizedExternalId,
                action: 'fallback_email',
                contactId: emailContact.id,
                identityId,
                metadata: { email: normalizedEmail },
            });

            return {
                ok: true,
                data: {
                    contactId: emailContact.id,
                    identityId,
                    source,
                    externalId: normalizedExternalId,
                    resolutionMethod: 'email',
                },
            };
        }
    }

    // Step 4: Auto-create contact if enabled
    if (autoCreate) {
        console.log('[Identity] Auto-creating contact:', {
            source,
            externalId: normalizedExternalId,
            name: contactName,
        });

        const createResult = await createContactWithIdentity(
            supabase,
            organizationId,
            source,
            normalizedExternalId,
            {
                name: contactName || `${source} Contact`,
                phone: source === 'WHATSAPP' ? normalizedPhone : null,
                avatar: contactAvatar,
            }
        );

        if (!createResult.ok) {
            await logIdentityResolution(supabase, {
                organizationId,
                source,
                externalId: normalizedExternalId,
                action: 'error',
                errorMessage: createResult.error,
                metadata: { stage: 'create_contact' },
            });
            return { ok: false, error: createResult.error, code: 'DB_ERROR' };
        }

        await logIdentityResolution(supabase, {
            organizationId,
            source,
            externalId: normalizedExternalId,
            action: 'created',
            contactId: createResult.contactId,
            identityId: createResult.identityId,
        });

        return {
            ok: true,
            data: {
                contactId: createResult.contactId,
                identityId: createResult.identityId,
                source,
                externalId: normalizedExternalId,
                resolutionMethod: 'created',
            },
        };
    }

    await logIdentityResolution(supabase, {
        organizationId,
        source,
        externalId: normalizedExternalId,
        action: 'not_found',
        metadata: {
            phoneProvided: Boolean(normalizedPhone),
            emailProvided: Boolean(normalizedEmail),
        },
    });

    return {
        ok: false,
        error: 'Contact not found for the given identity',
        code: 'NOT_FOUND',
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function logIdentityResolution(
    supabase: SupabaseClient,
    entry: {
        organizationId: string;
        source: MessagingSource;
        externalId: string;
        action: ResolutionLogAction;
        contactId?: string | null;
        identityId?: string | null;
        metadata?: Record<string, unknown>;
        errorMessage?: string | null;
    }
): Promise<void> {
    const { organizationId, source, externalId, action, contactId, identityId, metadata, errorMessage } = entry;

    const { error } = await supabase
        .from('messaging_identity_resolution_log')
        .insert({
            organization_id: organizationId,
            source,
            external_id: externalId,
            action,
            contact_id: contactId ?? null,
            identity_id: identityId ?? null,
            metadata: metadata ?? {},
            error_message: errorMessage ?? null,
        });

    // Logging is best effort and must never block message processing.
    if (error) {
        console.warn('[Identity] Failed to write resolution log:', error.message);
    }
}

/**
 * Create an identity mapping for an existing contact.
 *
 * Uses upsert to handle race conditions safely.
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization ID
 * @param contactId - Contact ID
 * @param source - Channel source
 * @param externalId - Normalized external identifier
 * @returns Identity ID or null on failure
 */
async function createIdentityMapping(
    supabase: SupabaseClient,
    organizationId: string,
    contactId: string,
    source: MessagingSource,
    externalId: string
): Promise<string | null> {
    const { data, error } = await supabase
        .from('messaging_contact_identities')
        .upsert(
            {
                organization_id: organizationId,
                contact_id: contactId,
                source,
                external_id: externalId,
            },
            {
                onConflict: 'organization_id,source,external_id',
            }
        )
        .select('id')
        .single();

    if (error) {
        console.warn('[Identity] Failed to create identity mapping:', error);
        return null;
    }

    console.log('[Identity] Created identity mapping:', data?.id);
    return data?.id ?? null;
}

/**
 * Create a new contact with an identity mapping.
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization ID
 * @param source - Channel source
 * @param externalId - External identifier
 * @param contactData - Contact creation data
 * @returns Contact and identity IDs or error
 */
async function createContactWithIdentity(
    supabase: SupabaseClient,
    organizationId: string,
    source: MessagingSource,
    externalId: string,
    contactData: {
        name: string;
        phone?: string | null;
        avatar?: string | null;
    }
): Promise<
    | { ok: true; contactId: string; identityId: string }
    | { ok: false; error: string }
> {
    // Create contact
    const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
            organization_id: organizationId,
            name: contactData.name,
            phone: contactData.phone || null,
            avatar: contactData.avatar || null,
            source: source, // Use channel as source
            status: 'ACTIVE',
            stage: 'LEAD',
        })
        .select('id')
        .single();

    if (contactError || !contact) {
        console.error('[Identity] Failed to create contact:', contactError);
        return {
            ok: false,
            error: contactError?.message ?? 'Failed to create contact',
        };
    }

    // Create identity mapping
    const { data: identity, error: identityError } = await supabase
        .from('messaging_contact_identities')
        .insert({
            organization_id: organizationId,
            contact_id: contact.id,
            source,
            external_id: externalId,
        })
        .select('id')
        .single();

    if (identityError || !identity) {
        console.error('[Identity] Failed to create identity:', identityError);
        // Contact was created but identity failed - still return contact
        // The identity can be created later
        return {
            ok: false,
            error: identityError?.message ?? 'Failed to create identity mapping',
        };
    }

    console.log('[Identity] Created contact and identity:', {
        contactId: contact.id,
        identityId: identity.id,
    });

    return { ok: true, contactId: contact.id, identityId: identity.id };
}

// ============================================================================
// Public Helper Functions
// ============================================================================

/**
 * Get all identities for a contact.
 *
 * @param supabase - Supabase client
 * @param contactId - Contact ID
 * @returns Array of identity records
 */
export async function getContactIdentities(
    supabase: SupabaseClient,
    contactId: string
): Promise<DbContactIdentity[]> {
    const { data, error } = await supabase
        .from('messaging_contact_identities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });

    if (error) {
        console.warn('[Identity] Failed to get identities:', error);
        return [];
    }

    return data ?? [];
}

/**
 * Link an existing contact to an external identity.
 *
 * Safe to call multiple times (idempotent via UNIQUE constraint).
 *
 * @param supabase - Supabase client
 * @param options - Link options
 * @returns Result with identity ID or error
 */
export async function linkContactToIdentity(
    supabase: SupabaseClient,
    options: {
        organizationId: string;
        contactId: string;
        source: MessagingSource;
        externalId: string;
    }
): Promise<{ ok: true; identityId: string } | { ok: false; error: string }> {
    const { organizationId, contactId, source, externalId } = options;

    const canonicalKey = buildIdentityKey(source, externalId);
    if (!canonicalKey) {
        return { ok: false, error: `Invalid external_id for source ${source}` };
    }

    const normalizedExternalId = canonicalKey.split(':')[1];

    const { data, error } = await supabase
        .from('messaging_contact_identities')
        .upsert(
            {
                organization_id: organizationId,
                contact_id: contactId,
                source,
                external_id: normalizedExternalId,
            },
            {
                onConflict: 'organization_id,source,external_id',
            }
        )
        .select('id')
        .single();

    if (error) {
        console.error('[Identity] Failed to link identity:', error);
        return { ok: false, error: error.message };
    }

    return { ok: true, identityId: data.id };
}

/**
 * Find contact ID by external identity.
 *
 * Simple lookup without fallbacks or auto-creation.
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization ID
 * @param source - Channel source
 * @param externalId - External identifier
 * @returns Contact ID or null
 */
export async function findContactByIdentity(
    supabase: SupabaseClient,
    organizationId: string,
    source: MessagingSource,
    externalId: string
): Promise<string | null> {
    const canonicalKey = buildIdentityKey(source, externalId);
    if (!canonicalKey) return null;

    const normalizedExternalId = canonicalKey.split(':')[1];

    const { data, error } = await supabase
        .from('messaging_contact_identities')
        .select('contact_id')
        .eq('organization_id', organizationId)
        .eq('source', source)
        .eq('external_id', normalizedExternalId)
        .maybeSingle();

    if (error || !data) return null;

    return data.contact_id;
}

/**
 * Delete all identities for a contact.
 *
 * Useful when merging contacts or cleaning up.
 *
 * @param supabase - Supabase client
 * @param contactId - Contact ID
 * @returns Number of deleted records
 */
export async function deleteContactIdentities(
    supabase: SupabaseClient,
    contactId: string
): Promise<number> {
    const { data, error } = await supabase
        .from('messaging_contact_identities')
        .delete()
        .eq('contact_id', contactId)
        .select('id');

    if (error) {
        console.warn('[Identity] Failed to delete identities:', error);
        return 0;
    }

    return data?.length ?? 0;
}

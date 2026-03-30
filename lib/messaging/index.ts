/**
 * Messaging Library
 *
 * Provides identity resolution and key generation for multi-channel messaging.
 *
 * @module lib/messaging
 *
 * @example
 * ```typescript
 * import {
 *     buildIdentityKey,
 *     resolveContactByIdentity,
 *     type MessagingSource,
 * } from '@/lib/messaging';
 *
 * // Build a canonical key
 * const key = buildIdentityKey('INSTAGRAM', '17841400000000000');
 * // => 'instagram:17841400000000000'
 *
 * // Resolve a contact by identity
 * const result = await resolveContactByIdentity(supabase, {
 *     organizationId: 'org-uuid',
 *     source: 'INSTAGRAM',
 *     externalId: '17841400000000000',
 *     autoCreate: true,
 * });
 * ```
 */

// ============================================================================
// Identity Key Utilities
// ============================================================================

export {
    // Types
    type MessagingSource,
    type ParsedIdentityKey,

    // Key building
    buildIdentityKey,
    buildIdentityKeyOrThrow,

    // Key parsing
    parseIdentityKey,

    // Validation
    isValidExternalId,
    isValidIdentityKey,

    // WhatsApp utilities
    extractPhoneFromWhatsAppJid,
    buildWhatsAppKeyFromJid,

    // Key component extraction
    getSourceFromKey,
    getExternalIdFromKey,
} from './identityKey';

// ============================================================================
// Identity Resolution Service
// ============================================================================

export {
    // Types
    type ResolvedIdentity,
    type ResolveIdentityOptions,
    type ResolveIdentityResult,
    type ResolveIdentityErrorCode,

    // Main resolution function
    resolveContactByIdentity,

    // Identity management
    getContactIdentities,
    linkContactToIdentity,
    findContactByIdentity,
    deleteContactIdentities,
} from './identityResolution';

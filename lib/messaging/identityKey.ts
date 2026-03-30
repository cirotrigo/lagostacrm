/**
 * @fileoverview Canonical identity key generation for messaging channels.
 *
 * Provides a standardized format for identifying contacts across channels,
 * used for Redis memory/buffer keys and session tracking.
 *
 * @example
 * ```typescript
 * import { buildIdentityKey, parseIdentityKey } from '@/lib/messaging/identityKey';
 *
 * // WhatsApp: uses E.164 phone
 * const whatsappKey = buildIdentityKey('WHATSAPP', '+5511999990000');
 * // => 'whatsapp:+5511999990000'
 *
 * // Instagram: uses IGSID
 * const instagramKey = buildIdentityKey('INSTAGRAM', '17841400000000000');
 * // => 'instagram:17841400000000000'
 * ```
 *
 * @module lib/messaging/identityKey
 */

import { normalizePhoneE164 } from '@/lib/phone';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported messaging channel sources.
 */
export type MessagingSource = 'WHATSAPP' | 'INSTAGRAM';

/**
 * Parsed identity key components.
 */
export interface ParsedIdentityKey {
    source: MessagingSource;
    externalId: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid messaging sources for validation.
 */
const VALID_SOURCES: readonly MessagingSource[] = ['WHATSAPP', 'INSTAGRAM'] as const;

/**
 * Instagram IGSID pattern: numeric string (17-digit Instagram Scoped ID).
 * Allow alphanumeric for future compatibility with different ID formats.
 */
const INSTAGRAM_ID_PATTERN = /^[a-zA-Z0-9_]+$/;

// ============================================================================
// Key Building Functions
// ============================================================================

/**
 * Build a canonical identity key for a messaging channel.
 *
 * The canonical key format is: `{source_lowercase}:{normalized_external_id}`
 *
 * Examples:
 * - WhatsApp: `whatsapp:+5511999990000`
 * - Instagram: `instagram:17841400000000000`
 *
 * @param source - Channel source (WHATSAPP or INSTAGRAM)
 * @param externalId - External identifier (phone for WhatsApp, IGSID for Instagram)
 * @returns Canonical key in format `{source}:{external_id}` or null if invalid
 *
 * @example
 * ```typescript
 * buildIdentityKey('WHATSAPP', '11999990000');
 * // => 'whatsapp:+5511999990000'
 *
 * buildIdentityKey('INSTAGRAM', '17841400000000000');
 * // => 'instagram:17841400000000000'
 *
 * buildIdentityKey('WHATSAPP', 'invalid');
 * // => null
 * ```
 */
export function buildIdentityKey(
    source: MessagingSource,
    externalId: string | null | undefined
): string | null {
    if (!externalId) return null;

    const trimmed = externalId.trim();
    if (!trimmed) return null;

    // Validate source
    if (!VALID_SOURCES.includes(source)) return null;

    // Normalize based on source
    let normalizedId: string;

    switch (source) {
        case 'WHATSAPP': {
            // Normalize phone to E.164
            const e164 = normalizePhoneE164(trimmed);
            // normalizePhoneE164 returns empty string for invalid, check length
            if (!e164 || e164.length < 8) return null;
            normalizedId = e164;
            break;
        }

        case 'INSTAGRAM': {
            // Instagram IGSID should be alphanumeric
            if (!INSTAGRAM_ID_PATTERN.test(trimmed)) return null;
            normalizedId = trimmed;
            break;
        }

        default:
            return null;
    }

    return `${source.toLowerCase()}:${normalizedId}`;
}

/**
 * Build an identity key or throw an error.
 *
 * Same as `buildIdentityKey` but throws instead of returning null.
 *
 * @param source - Channel source
 * @param externalId - External identifier
 * @returns Canonical key
 * @throws Error if key cannot be built
 */
export function buildIdentityKeyOrThrow(
    source: MessagingSource,
    externalId: string | null | undefined
): string {
    const key = buildIdentityKey(source, externalId);
    if (!key) {
        throw new Error(
            `Invalid external_id "${externalId}" for source "${source}"`
        );
    }
    return key;
}

// ============================================================================
// Key Parsing Functions
// ============================================================================

/**
 * Parse a canonical identity key back to source and external_id.
 *
 * @param key - Canonical key in format `{source}:{external_id}`
 * @returns Parsed key components or null if invalid
 *
 * @example
 * ```typescript
 * parseIdentityKey('whatsapp:+5511999990000');
 * // => { source: 'WHATSAPP', externalId: '+5511999990000' }
 *
 * parseIdentityKey('instagram:17841400000000000');
 * // => { source: 'INSTAGRAM', externalId: '17841400000000000' }
 *
 * parseIdentityKey('invalid');
 * // => null
 * ```
 */
export function parseIdentityKey(
    key: string | null | undefined
): ParsedIdentityKey | null {
    if (!key) return null;

    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) return null;

    const sourcePart = key.substring(0, colonIndex).toUpperCase();
    const externalId = key.substring(colonIndex + 1);

    if (!externalId) return null;

    // Validate source
    if (!VALID_SOURCES.includes(sourcePart as MessagingSource)) {
        return null;
    }

    return {
        source: sourcePart as MessagingSource,
        externalId,
    };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that an external ID is valid for the given source.
 *
 * This is a quick validation check that doesn't perform full normalization.
 *
 * @param source - Channel source
 * @param externalId - External identifier to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidExternalId('WHATSAPP', '+5511999990000');
 * // => true
 *
 * isValidExternalId('INSTAGRAM', '');
 * // => false
 * ```
 */
export function isValidExternalId(
    source: MessagingSource,
    externalId: string | null | undefined
): boolean {
    return buildIdentityKey(source, externalId) !== null;
}

/**
 * Check if a string is a valid canonical identity key.
 *
 * @param key - String to validate
 * @returns true if valid key format
 */
export function isValidIdentityKey(key: string | null | undefined): boolean {
    return parseIdentityKey(key) !== null;
}

// ============================================================================
// WhatsApp-Specific Utilities
// ============================================================================

/**
 * Extract phone number from WhatsApp remote_jid format.
 *
 * WhatsApp JID formats:
 * - Individual: `5511999990000@c.us` or `5511999990000@s.whatsapp.net`
 * - Group: `5511999990000-1234567890@g.us`
 *
 * @param remoteJid - WhatsApp JID (e.g., '5511999990000@c.us')
 * @returns Normalized E.164 phone or null
 *
 * @example
 * ```typescript
 * extractPhoneFromWhatsAppJid('5511999990000@c.us');
 * // => '+5511999990000'
 *
 * extractPhoneFromWhatsAppJid('5511999990000@s.whatsapp.net');
 * // => '+5511999990000'
 *
 * extractPhoneFromWhatsAppJid('group@g.us');
 * // => null (groups not supported)
 * ```
 */
export function extractPhoneFromWhatsAppJid(
    remoteJid: string | null | undefined
): string | null {
    if (!remoteJid) return null;

    // Skip group JIDs
    if (remoteJid.includes('@g.us')) return null;

    // Remove @c.us or @s.whatsapp.net suffix
    const phoneOnly = remoteJid.replace(/@[a-z.]+$/i, '');

    // Skip if it looks like a group ID (contains hyphen)
    if (phoneOnly.includes('-')) return null;

    // Normalize to E.164 (add + prefix if missing)
    const withPlus = phoneOnly.startsWith('+') ? phoneOnly : `+${phoneOnly}`;

    const normalized = normalizePhoneE164(withPlus);
    return normalized && normalized.length >= 8 ? normalized : null;
}

/**
 * Build a WhatsApp identity key from a remote JID.
 *
 * Convenience function that extracts phone and builds key in one step.
 *
 * @param remoteJid - WhatsApp JID
 * @returns Canonical key or null
 */
export function buildWhatsAppKeyFromJid(
    remoteJid: string | null | undefined
): string | null {
    const phone = extractPhoneFromWhatsAppJid(remoteJid);
    if (!phone) return null;
    return buildIdentityKey('WHATSAPP', phone);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the source from a canonical key without full parsing.
 *
 * @param key - Canonical key
 * @returns Source or null
 */
export function getSourceFromKey(
    key: string | null | undefined
): MessagingSource | null {
    if (!key) return null;
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) return null;

    const source = key.substring(0, colonIndex).toUpperCase();
    return VALID_SOURCES.includes(source as MessagingSource)
        ? (source as MessagingSource)
        : null;
}

/**
 * Get the external ID from a canonical key without full parsing.
 *
 * @param key - Canonical key
 * @returns External ID or null
 */
export function getExternalIdFromKey(
    key: string | null | undefined
): string | null {
    if (!key) return null;
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) return null;
    return key.substring(colonIndex + 1) || null;
}

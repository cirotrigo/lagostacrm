/**
 * Returns true when URL path points to Chatwoot ActiveStorage assets.
 */
function isChatwootAssetPath(pathname: string): boolean {
    return pathname.startsWith('/rails/active_storage/');
}

function toOrigin(input: string | null | undefined): string | null {
    if (!input) return null;
    try {
        return new URL(input).origin;
    } catch {
        return null;
    }
}

/**
 * Normalize avatar URL to use the configured/public Chatwoot base URL.
 *
 * Why:
 * - Some Chatwoot setups return internal/private hostnames in `thumbnail`.
 * - We rewrite only ActiveStorage avatar paths, keeping external CDN URLs untouched.
 */
export function normalizeChatwootAvatarUrl(
    avatarUrl: string | null | undefined,
    chatwootBaseUrl?: string | null
): string | null {
    const raw = (avatarUrl || '').trim();
    if (!raw) return null;

    const targetOrigin = toOrigin(chatwootBaseUrl);
    if (!targetOrigin) return raw;

    // Relative URL returned by webhook/client.
    if (raw.startsWith('/')) {
        return `${targetOrigin}${raw}`;
    }

    try {
        const parsed = new URL(raw);
        if (!isChatwootAssetPath(parsed.pathname)) {
            return raw;
        }

        if (parsed.origin === targetOrigin) {
            return raw;
        }

        parsed.protocol = new URL(targetOrigin).protocol;
        parsed.host = new URL(targetOrigin).host;
        return parsed.toString();
    } catch {
        return raw;
    }
}

/**
 * Detects if a URL will be rewritten by `normalizeChatwootAvatarUrl`.
 */
export function needsChatwootAvatarRewrite(
    avatarUrl: string | null | undefined,
    chatwootBaseUrl?: string | null
): boolean {
    const raw = (avatarUrl || '').trim();
    if (!raw) return false;
    const normalized = normalizeChatwootAvatarUrl(raw, chatwootBaseUrl);
    return normalized !== raw;
}

import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { syncChatwootContactAvatars } from '@/lib/chatwoot/avatarSync';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface CronAuthResult {
    ok: boolean;
    status: number;
    error?: string;
}

function parseBearerToken(authHeader: string | null): string | null {
    if (!authHeader) return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

function validateCronAuth(request: NextRequest): CronAuthResult {
    const configuredSecret = process.env.CRON_SECRET;

    if (!configuredSecret) {
        return {
            ok: false,
            status: 500,
            error: 'CRON_SECRET is not configured',
        };
    }

    const token = parseBearerToken(request.headers.get('authorization'));
    if (!token || token !== configuredSecret) {
        return {
            ok: false,
            status: 401,
            error: 'Unauthorized',
        };
    }

    return { ok: true, status: 200 };
}

function parseBoolean(value: string | null): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseBatchSize(value: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(Math.max(parsed, 10), 500);
}

export async function GET(request: NextRequest) {
    try {
        const auth = validateCronAuth(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const orgId = request.nextUrl.searchParams.get('org_id') || undefined;
        const dryRun = parseBoolean(request.nextUrl.searchParams.get('dry_run'));
        const verbose = parseBoolean(request.nextUrl.searchParams.get('verbose'));
        const batchSize = parseBatchSize(request.nextUrl.searchParams.get('batch_size'));

        const supabase = createStaticAdminClient();
        const summary = await syncChatwootContactAvatars(supabase, {
            organizationId: orgId,
            dryRun,
            verbose,
            batchSize,
        });

        return NextResponse.json(summary);
    } catch (error) {
        console.error('[cron/sync-chatwoot-avatars] Error:', error);
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json(
            { error: 'Failed to sync avatars', details: message },
            { status: 500 }
        );
    }
}

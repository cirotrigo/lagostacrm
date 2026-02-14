import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/chatwoot/conversations/[id]/upload
 *
 * Upload an attachment (image, audio, video, document) to a conversation
 *
 * Body (FormData):
 * - file: File (required) - The file to upload
 * - content: string (optional) - Message text/caption
 * - private: boolean (optional, default false) - Whether this is a private note
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const conversationId = parseInt(id, 10);

        if (isNaN(conversationId)) {
            return NextResponse.json(
                { error: 'Invalid conversation ID' },
                { status: 400 }
            );
        }

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

        // Parse form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const content = formData.get('content') as string | null;
        const isPrivate = formData.get('private') === 'true';

        if (!file) {
            return NextResponse.json(
                { error: 'File is required' },
                { status: 400 }
            );
        }

        // Validate file size (max 40MB for most file types)
        const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40MB
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 40MB' },
                { status: 400 }
            );
        }

        // Debug log
        console.log('[Upload API] Uploading attachment:', {
            conversationId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            hasContent: !!content,
            isPrivate,
        });

        // Upload the attachment using Chatwoot client
        const message = await chatwoot.uploadAttachment(
            conversationId,
            file,
            content || undefined,
            isPrivate
        );

        console.log('[Upload API] Upload successful:', {
            messageId: message.id,
            attachmentsCount: message.attachments?.length || 0,
        });

        return NextResponse.json({ data: message }, { status: 201 });
    } catch (error) {
        console.error('Error uploading attachment:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload attachment' },
            { status: 500 }
        );
    }
}

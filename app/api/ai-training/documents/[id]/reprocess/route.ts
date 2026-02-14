/**
 * POST /api/ai-training/documents/[id]/reprocess
 * Reprocessa um documento existente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reprocessDocument } from '@/lib/ai-training/processor';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
    _request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        // Autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Não autenticado' },
                { status: 401 }
            );
        }

        // Busca perfil e verifica admin
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Perfil não encontrado' },
                { status: 404 }
            );
        }

        if (profile.role !== 'admin') {
            return NextResponse.json(
                { error: 'Apenas administradores podem reprocessar documentos' },
                { status: 403 }
            );
        }

        // Busca chave OpenAI da organização
        const { data: orgSettings } = await supabase
            .from('organization_settings')
            .select('ai_openai_key')
            .eq('organization_id', profile.organization_id)
            .single();

        const apiKey = orgSettings?.ai_openai_key;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Chave OpenAI não configurada. Configure em Configurações > Central de I.A.' },
                { status: 400 }
            );
        }

        // Verifica se documento existe e pertence à organização
        const { data: document, error: docError } = await supabase
            .from('ai_training_documents')
            .select('id')
            .eq('id', id)
            .eq('organization_id', profile.organization_id)
            .single();

        if (docError || !document) {
            return NextResponse.json(
                { error: 'Documento não encontrado' },
                { status: 404 }
            );
        }

        // Reprocessa
        const result = await reprocessDocument(
            id,
            profile.organization_id,
            apiKey
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.errorMessage || 'Erro no reprocessamento' },
                { status: 500 }
            );
        }

        // Busca documento atualizado
        const { data: updatedDocument } = await supabase
            .from('ai_training_documents')
            .select()
            .eq('id', id)
            .single();

        return NextResponse.json({
            success: true,
            document: updatedDocument,
            chunkCount: result.chunkCount,
            totalTokens: result.totalTokens,
        });

    } catch (error) {
        console.error('Error in POST /api/ai-training/documents/[id]/reprocess:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno' },
            { status: 500 }
        );
    }
}

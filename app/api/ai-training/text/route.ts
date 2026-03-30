/**
 * POST /api/ai-training/text
 * Cria um novo documento de texto livre para treinamento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocument } from '@/lib/ai-training/processor';
import type { CreateTextDocumentRequest } from '@/lib/ai-training/types';

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
    try {
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
                { error: 'Apenas administradores podem adicionar documentos de treinamento' },
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

        // Valida body
        const body = await request.json() as CreateTextDocumentRequest;

        if (!body.title?.trim()) {
            return NextResponse.json(
                { error: 'Título é obrigatório' },
                { status: 400 }
            );
        }

        if (!body.content?.trim()) {
            return NextResponse.json(
                { error: 'Conteúdo é obrigatório' },
                { status: 400 }
            );
        }

        // Cria documento
        const { data: document, error: insertError } = await supabase
            .from('ai_training_documents')
            .insert({
                organization_id: profile.organization_id,
                type: 'text',
                title: body.title.trim(),
                content: body.content.trim(),
                status: 'processing',
                created_by: user.id,
            })
            .select()
            .single();

        if (insertError || !document) {
            return NextResponse.json(
                { error: `Erro ao criar documento: ${insertError?.message}` },
                { status: 500 }
            );
        }

        // Processa documento (síncrono)
        const result = await processDocument(
            document.id,
            profile.organization_id,
            apiKey
        );

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.errorMessage || 'Erro no processamento',
                    document: { ...document, status: 'error' }
                },
                { status: 500 }
            );
        }

        // Busca documento atualizado
        const { data: updatedDocument } = await supabase
            .from('ai_training_documents')
            .select()
            .eq('id', document.id)
            .single();

        return NextResponse.json({
            success: true,
            document: updatedDocument,
            chunkCount: result.chunkCount,
            totalTokens: result.totalTokens,
        });

    } catch (error) {
        console.error('Error in POST /api/ai-training/text:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno' },
            { status: 500 }
        );
    }
}

/**
 * /api/ai-training/documents/[id]
 * GET: Detalhes de um documento específico
 * DELETE: Remove documento e seus chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteDocumentChunks } from '@/lib/ai-training/processor';
import { transformDbToDocument, type DbTrainingDocument } from '@/lib/ai-training/types';

const STORAGE_BUCKET = 'ai-training';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/ai-training/documents/[id]
 * Retorna detalhes de um documento com seus chunks
 */
export async function GET(
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

        // Busca perfil
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Perfil não encontrado' },
                { status: 404 }
            );
        }

        // Busca documento
        const { data: document, error: docError } = await supabase
            .from('ai_training_documents')
            .select('*')
            .eq('id', id)
            .eq('organization_id', profile.organization_id)
            .single();

        if (docError || !document) {
            return NextResponse.json(
                { error: 'Documento não encontrado' },
                { status: 404 }
            );
        }

        // Busca chunks (sem embeddings para não sobrecarregar)
        const { data: chunks } = await supabase
            .from('documents')
            .select('id, content, metadata, created_at')
            .eq('training_doc_id', id)
            .order('created_at', { ascending: true });

        return NextResponse.json({
            document: transformDbToDocument(document as DbTrainingDocument),
            chunks: chunks || [],
        });

    } catch (error) {
        console.error('Error in GET /api/ai-training/documents/[id]:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/ai-training/documents/[id]
 * Remove documento, seus chunks e arquivo do storage
 */
export async function DELETE(
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
                { error: 'Apenas administradores podem remover documentos de treinamento' },
                { status: 403 }
            );
        }

        // Busca documento para obter info do arquivo
        const { data: document, error: docError } = await supabase
            .from('ai_training_documents')
            .select('*')
            .eq('id', id)
            .eq('organization_id', profile.organization_id)
            .single();

        if (docError || !document) {
            return NextResponse.json(
                { error: 'Documento não encontrado' },
                { status: 404 }
            );
        }

        // Remove arquivo do storage se existir
        if (document.source_file_url) {
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .remove([document.source_file_url]);

            if (storageError) {
                console.warn('Erro ao remover arquivo do storage:', storageError.message);
                // Continua mesmo com erro - o documento e chunks serão removidos
            }
        }

        // Remove chunks (CASCADE faria isso, mas vamos garantir)
        await deleteDocumentChunks(id);

        // Remove documento
        const { error: deleteError } = await supabase
            .from('ai_training_documents')
            .delete()
            .eq('id', id);

        if (deleteError) {
            return NextResponse.json(
                { error: `Erro ao remover documento: ${deleteError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Documento removido com sucesso',
        });

    } catch (error) {
        console.error('Error in DELETE /api/ai-training/documents/[id]:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno' },
            { status: 500 }
        );
    }
}

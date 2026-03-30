/**
 * /api/ai-training/documents
 * GET: Lista documentos de treinamento com estatísticas
 * POST: Upload de PDF para treinamento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocument, getTrainingStats } from '@/lib/ai-training/processor';
import { transformDbToDocument, type DbTrainingDocument } from '@/lib/ai-training/types';

const STORAGE_BUCKET = 'ai-training';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * GET /api/ai-training/documents
 * Lista todos os documentos de treinamento da organização
 */
export async function GET() {
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

        // Busca documentos
        const { data: documents, error: docsError } = await supabase
            .from('ai_training_documents')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

        if (docsError) {
            return NextResponse.json(
                { error: `Erro ao buscar documentos: ${docsError.message}` },
                { status: 500 }
            );
        }

        // Busca estatísticas
        const stats = await getTrainingStats(profile.organization_id);

        // Transforma para formato da API
        const transformedDocs = (documents as DbTrainingDocument[]).map(transformDbToDocument);

        return NextResponse.json({
            documents: transformedDocs,
            stats,
        });

    } catch (error) {
        console.error('Error in GET /api/ai-training/documents:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/ai-training/documents
 * Upload de arquivo PDF para treinamento
 */
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

        // Parse FormData
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'Nenhum arquivo enviado' },
                { status: 400 }
            );
        }

        // Valida tipo
        if (file.type !== 'application/pdf') {
            return NextResponse.json(
                { error: 'Apenas arquivos PDF são aceitos' },
                { status: 400 }
            );
        }

        // Valida tamanho
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'Arquivo muito grande. Máximo permitido: 20MB' },
                { status: 400 }
            );
        }

        // Gera path único para o arquivo
        const fileExt = 'pdf';
        const fileName = `${profile.organization_id}/${crypto.randomUUID()}.${fileExt}`;

        // Upload para Storage
        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, file, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (uploadError) {
            return NextResponse.json(
                { error: `Erro no upload: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // Cria documento no banco
        const { data: document, error: insertError } = await supabase
            .from('ai_training_documents')
            .insert({
                organization_id: profile.organization_id,
                type: 'pdf',
                title: file.name.replace(/\.pdf$/i, ''),
                source_file_url: fileName,
                source_file_name: file.name,
                status: 'processing',
                created_by: user.id,
                metadata: {
                    size: file.size,
                    mime_type: file.type,
                },
            })
            .select()
            .single();

        if (insertError || !document) {
            // Tenta limpar arquivo do storage
            await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);

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
        console.error('Error in POST /api/ai-training/documents:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno' },
            { status: 500 }
        );
    }
}

/**
 * AI Training / RAG - Document Processor
 * Orquestra o processamento de documentos: extração, chunking, embeddings
 */

import { createClient } from '@/lib/supabase/server';
import { chunkText, formatQAContent } from './chunker';
import { generateEmbeddings } from './embeddings';
import type {
    DbTrainingDocument,
    ChunkMetadata,
    ProcessingResult,
    TrainingDocumentType,
} from './types';

// Lazy import para evitar carregar pdf-parse no módulo principal
async function extractTextFromPdf(buffer: ArrayBuffer | Buffer): Promise<string> {
    const { extractTextFromPdf: extract } = await import('./pdfExtractor');
    return extract(buffer);
}

const STORAGE_BUCKET = 'ai-training';

/**
 * Processa um documento de treinamento.
 *
 * Fluxo:
 * 1. Atualiza status para 'processing'
 * 2. Extrai texto (PDF) ou formata conteúdo (text/qa)
 * 3. Divide em chunks
 * 4. Gera embeddings
 * 5. Insere chunks na tabela `documents`
 * 6. Atualiza documento com stats
 *
 * @param documentId - ID do documento a processar
 * @param organizationId - ID da organização
 * @param apiKey - Chave da API OpenAI
 */
export async function processDocument(
    documentId: string,
    organizationId: string,
    apiKey: string
): Promise<ProcessingResult> {
    const supabase = await createClient();

    try {
        // 1. Buscar documento
        const { data: document, error: fetchError } = await supabase
            .from('ai_training_documents')
            .select('*')
            .eq('id', documentId)
            .single();

        if (fetchError || !document) {
            throw new Error(`Documento não encontrado: ${documentId}`);
        }

        const doc = document as DbTrainingDocument;

        // 2. Atualizar status para 'processing'
        await supabase
            .from('ai_training_documents')
            .update({ status: 'processing', error_message: null })
            .eq('id', documentId);

        // 3. Extrair/preparar conteúdo
        let textContent: string;

        switch (doc.type as TrainingDocumentType) {
            case 'pdf':
                textContent = await extractPdfContent(supabase, doc);
                break;

            case 'qa':
                if (!doc.question || !doc.answer) {
                    throw new Error('Documento Q&A sem pergunta ou resposta');
                }
                textContent = formatQAContent(doc.question, doc.answer);
                break;

            case 'text':
                if (!doc.content) {
                    throw new Error('Documento de texto sem conteúdo');
                }
                textContent = doc.content;
                break;

            default:
                throw new Error(`Tipo de documento não suportado: ${doc.type}`);
        }

        // 4. Fazer chunking (Q&A não precisa de chunking)
        const chunks = doc.type === 'qa'
            ? [textContent]
            : chunkText(textContent);

        if (chunks.length === 0) {
            throw new Error('Nenhum conteúdo extraído do documento');
        }

        // 5. Gerar embeddings
        const embeddingResults = await generateEmbeddings(chunks, apiKey);

        // 6. Preparar e inserir chunks na tabela `documents`
        const chunksToInsert = chunks.map((content, index) => {
            const metadata: ChunkMetadata = {
                organization_id: organizationId,
                training_doc_id: documentId,
                doc_type: doc.type as TrainingDocumentType,
                title: doc.title,
                chunk_index: index,
            };

            return {
                content,
                metadata,
                embedding: embeddingResults[index].embedding,
                training_doc_id: documentId,
                organization_id: organizationId,
            };
        });

        // Insere em batches para evitar payload muito grande
        const BATCH_SIZE = 50;
        for (let i = 0; i < chunksToInsert.length; i += BATCH_SIZE) {
            const batch = chunksToInsert.slice(i, i + BATCH_SIZE);

            const { error: insertError } = await supabase
                .from('documents')
                .insert(batch);

            if (insertError) {
                throw new Error(`Erro ao inserir chunks: ${insertError.message}`);
            }
        }

        // 7. Calcular totais
        const totalTokens = embeddingResults.reduce((sum, r) => sum + r.tokenCount, 0);
        const chunkCount = chunks.length;

        // 8. Atualizar documento com sucesso
        // Salva o conteúdo extraído para PDFs
        const updateData: Partial<DbTrainingDocument> = {
            status: 'processed',
            chunk_count: chunkCount,
            total_tokens: totalTokens,
            error_message: null,
        };

        if (doc.type === 'pdf') {
            updateData.content = textContent;
        }

        await supabase
            .from('ai_training_documents')
            .update(updateData)
            .eq('id', documentId);

        return {
            success: true,
            chunkCount,
            totalTokens,
        };

    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : 'Erro desconhecido no processamento';

        // Atualizar documento com erro
        await supabase
            .from('ai_training_documents')
            .update({
                status: 'error',
                error_message: errorMessage,
            })
            .eq('id', documentId);

        return {
            success: false,
            chunkCount: 0,
            totalTokens: 0,
            errorMessage,
        };
    }
}

/**
 * Extrai conteúdo de um PDF armazenado no Storage.
 */
async function extractPdfContent(
    supabase: Awaited<ReturnType<typeof createClient>>,
    doc: DbTrainingDocument
): Promise<string> {
    if (!doc.source_file_url) {
        throw new Error('PDF sem URL de arquivo');
    }

    // Extrai o path do arquivo da URL
    // URL formato: https://xxx.supabase.co/storage/v1/object/public/ai-training/org-id/doc-id.pdf
    // Ou path direto: org-id/doc-id.pdf
    let filePath = doc.source_file_url;

    // Se for URL completa, extrai o path
    if (filePath.includes('/storage/v1/object/')) {
        const match = filePath.match(/\/storage\/v1\/object\/(?:public|sign)\/ai-training\/(.+)/);
        if (match) {
            filePath = match[1];
        }
    }

    // Download do arquivo
    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(filePath);

    if (error || !data) {
        throw new Error(`Erro ao baixar PDF: ${error?.message || 'arquivo não encontrado'}`);
    }

    // Converte Blob para ArrayBuffer
    const arrayBuffer = await data.arrayBuffer();

    // Extrai texto
    return extractTextFromPdf(arrayBuffer);
}

/**
 * Reprocessa um documento existente.
 * Remove chunks antigos e processa novamente.
 */
export async function reprocessDocument(
    documentId: string,
    organizationId: string,
    apiKey: string
): Promise<ProcessingResult> {
    const supabase = await createClient();

    // Remove chunks existentes
    await supabase
        .from('documents')
        .delete()
        .eq('training_doc_id', documentId);

    // Reseta contadores
    await supabase
        .from('ai_training_documents')
        .update({
            status: 'pending',
            chunk_count: 0,
            total_tokens: 0,
            error_message: null,
        })
        .eq('id', documentId);

    // Processa novamente
    return processDocument(documentId, organizationId, apiKey);
}

/**
 * Remove todos os chunks de um documento.
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
    const supabase = await createClient();

    await supabase
        .from('documents')
        .delete()
        .eq('training_doc_id', documentId);
}

/**
 * Obtém estatísticas de treinamento para uma organização.
 */
export async function getTrainingStats(organizationId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalTokens: number;
}> {
    const supabase = await createClient();

    // Conta documentos e soma tokens
    const { data: docs } = await supabase
        .from('ai_training_documents')
        .select('total_tokens')
        .eq('organization_id', organizationId)
        .eq('status', 'processed');

    // Conta chunks
    const { count: chunkCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

    const totalDocuments = docs?.length || 0;
    const totalTokens = docs?.reduce((sum, d) => sum + (d.total_tokens || 0), 0) || 0;

    return {
        totalDocuments,
        totalChunks: chunkCount || 0,
        totalTokens,
    };
}

/**
 * AI Training / RAG - Types
 * Tipos TypeScript para o sistema de treinamento do agente
 */

// =============================================================================
// Database Types (espelho do schema)
// =============================================================================

export type TrainingDocumentType = 'pdf' | 'text' | 'qa';
export type TrainingDocumentStatus = 'pending' | 'processing' | 'processed' | 'error';

export interface DbTrainingDocument {
    id: string;
    organization_id: string;
    type: TrainingDocumentType;
    title: string;
    content: string | null;
    source_file_url: string | null;
    source_file_name: string | null;
    question: string | null;
    answer: string | null;
    metadata: Record<string, unknown>;
    status: TrainingDocumentStatus;
    error_message: string | null;
    chunk_count: number;
    total_tokens: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbDocumentChunk {
    id: string;
    content: string;
    metadata: ChunkMetadata;
    embedding: number[] | null;
    training_doc_id: string;
    organization_id: string;
    created_at: string;
}

// =============================================================================
// Application Types
// =============================================================================

export interface TrainingDocument {
    id: string;
    organizationId: string;
    type: TrainingDocumentType;
    title: string;
    content: string | null;
    sourceFileUrl: string | null;
    sourceFileName: string | null;
    question: string | null;
    answer: string | null;
    status: TrainingDocumentStatus;
    errorMessage: string | null;
    chunkCount: number;
    totalTokens: number;
    createdAt: string;
    updatedAt: string;
}

export interface ChunkMetadata {
    organization_id: string;
    training_doc_id: string;
    doc_type: TrainingDocumentType;
    title: string;
    chunk_index: number;
}

export interface DocumentChunk {
    id: string;
    content: string;
    embedding: number[];
    metadata: ChunkMetadata;
}

// =============================================================================
// API Types
// =============================================================================

export interface TrainingStats {
    totalDocuments: number;
    totalChunks: number;
    totalTokens: number;
}

export interface TrainingDocumentsResponse {
    documents: TrainingDocument[];
    stats: TrainingStats;
}

export interface CreateTextDocumentRequest {
    title: string;
    content: string;
}

export interface CreateQADocumentRequest {
    question: string;
    answer: string;
}

export interface UpdateTextDocumentRequest {
    title?: string;
    content?: string;
}

export interface UpdateQADocumentRequest {
    question?: string;
    answer?: string;
}

export type UpdateDocumentRequest = UpdateTextDocumentRequest | UpdateQADocumentRequest;

// =============================================================================
// Processing Types
// =============================================================================

export interface ChunkOptions {
    maxTokens?: number;     // default 500
    overlapTokens?: number; // default 50
}

export interface EmbeddingResult {
    embedding: number[];
    tokenCount: number;
}

export interface ProcessingResult {
    success: boolean;
    chunkCount: number;
    totalTokens: number;
    errorMessage?: string;
}

// =============================================================================
// Transform Functions
// =============================================================================

export function transformDbToDocument(db: DbTrainingDocument): TrainingDocument {
    return {
        id: db.id,
        organizationId: db.organization_id,
        type: db.type,
        title: db.title,
        content: db.content,
        sourceFileUrl: db.source_file_url,
        sourceFileName: db.source_file_name,
        question: db.question,
        answer: db.answer,
        status: db.status,
        errorMessage: db.error_message,
        chunkCount: db.chunk_count,
        totalTokens: db.total_tokens,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

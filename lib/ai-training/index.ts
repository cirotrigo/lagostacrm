/**
 * AI Training / RAG - Module Index
 * Exports públicos do módulo de treinamento
 */

// Types
export type {
    TrainingDocument,
    TrainingDocumentType,
    TrainingDocumentStatus,
    TrainingStats,
    TrainingDocumentsResponse,
    CreateTextDocumentRequest,
    CreateQADocumentRequest,
    ChunkMetadata,
    DocumentChunk,
    ChunkOptions,
    EmbeddingResult,
    ProcessingResult,
    DbTrainingDocument,
    DbDocumentChunk,
} from './types';

export { transformDbToDocument } from './types';

// Chunking
export { chunkText, formatQAContent, estimateTokens } from './chunker';

// Embeddings
export { generateEmbeddings, generateEmbedding } from './embeddings';

// PDF
export { extractTextFromPdf, extractPdfMetadata } from './pdfExtractor';

// Processor
export {
    processDocument,
    reprocessDocument,
    deleteDocumentChunks,
    getTrainingStats,
} from './processor';

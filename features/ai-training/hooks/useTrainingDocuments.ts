'use client';

/**
 * React Query hooks for AI Training documents
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type {
    TrainingDocument,
    TrainingStats,
    TrainingDocumentsResponse,
    CreateTextDocumentRequest,
    CreateQADocumentRequest,
    UpdateDocumentRequest,
} from '@/lib/ai-training/types';

// =============================================================================
// Fetch Functions
// =============================================================================

async function fetchDocuments(): Promise<TrainingDocumentsResponse> {
    const res = await fetch('/api/ai-training/documents', {
        credentials: 'include',
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao buscar documentos');
    }

    return res.json();
}

async function fetchStats(): Promise<TrainingStats> {
    const res = await fetch('/api/ai-training/stats', {
        credentials: 'include',
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao buscar estatísticas');
    }

    return res.json();
}

async function createQADocument(data: CreateQADocumentRequest): Promise<TrainingDocument> {
    const res = await fetch('/api/ai-training/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || 'Erro ao criar documento Q&A');
    }

    return json.document;
}

async function createTextDocument(data: CreateTextDocumentRequest): Promise<TrainingDocument> {
    const res = await fetch('/api/ai-training/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || 'Erro ao criar documento de texto');
    }

    return json.document;
}

async function uploadPdfDocument(file: File): Promise<TrainingDocument> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/ai-training/documents', {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || 'Erro ao fazer upload do PDF');
    }

    return json.document;
}

async function deleteDocument(id: string): Promise<void> {
    const res = await fetch(`/api/ai-training/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erro ao remover documento');
    }
}

async function reprocessDocument(id: string): Promise<TrainingDocument> {
    const res = await fetch(`/api/ai-training/documents/${id}/reprocess`, {
        method: 'POST',
        credentials: 'include',
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || 'Erro ao reprocessar documento');
    }

    return json.document;
}

async function updateDocument({ id, data }: { id: string; data: UpdateDocumentRequest }): Promise<TrainingDocument> {
    const res = await fetch(`/api/ai-training/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || 'Erro ao atualizar documento');
    }

    return json.document;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook para buscar documentos de treinamento
 */
export function useTrainingDocuments() {
    return useQuery({
        queryKey: queryKeys.aiTraining.documents(),
        queryFn: fetchDocuments,
    });
}

/**
 * Hook para buscar apenas estatísticas
 */
export function useTrainingStats() {
    return useQuery({
        queryKey: queryKeys.aiTraining.stats(),
        queryFn: fetchStats,
    });
}

/**
 * Hook para criar documento Q&A
 */
export function useCreateQADocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createQADocument,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aiTraining.all,
            });
        },
    });
}

/**
 * Hook para criar documento de texto
 */
export function useCreateTextDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createTextDocument,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aiTraining.all,
            });
        },
    });
}

/**
 * Hook para upload de PDF
 */
export function useUploadPdfDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: uploadPdfDocument,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aiTraining.all,
            });
        },
    });
}

/**
 * Hook para deletar documento
 */
export function useDeleteDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteDocument,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aiTraining.all,
            });
        },
    });
}

/**
 * Hook para reprocessar documento
 */
export function useReprocessDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: reprocessDocument,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aiTraining.all,
            });
        },
    });
}

/**
 * Hook para atualizar documento
 */
export function useUpdateDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateDocument,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aiTraining.all,
            });
        },
    });
}

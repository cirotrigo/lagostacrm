'use client';

import React, { useState } from 'react';
import {
    FileText,
    MessageSquare,
    FileType,
    Trash2,
    RefreshCw,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock,
    Eye,
    Pencil,
} from 'lucide-react';
import type { TrainingDocument } from '@/lib/ai-training/types';
import { useDeleteDocument, useReprocessDocument } from '../hooks';
import { useToast } from '@/context/ToastContext';
import { Modal } from '@/components/ui/Modal';

interface DocumentListProps {
    documents: TrainingDocument[];
    isAdmin: boolean;
    isLoading?: boolean;
    onEdit?: (document: TrainingDocument) => void;
}

const typeIcons = {
    pdf: FileText,
    text: FileType,
    qa: MessageSquare,
};

const typeLabels = {
    pdf: 'PDF',
    text: 'Texto',
    qa: 'Q&A',
};

const statusConfig = {
    pending: {
        icon: Clock,
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/10',
        label: 'Pendente',
        animate: false,
    },
    processing: {
        icon: Loader2,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        label: 'Processando...',
        animate: true,
    },
    processed: {
        icon: CheckCircle2,
        color: 'text-green-500',
        bg: 'bg-green-500/10',
        label: 'Processado',
        animate: false,
    },
    error: {
        icon: AlertCircle,
        color: 'text-red-500',
        bg: 'bg-red-500/10',
        label: 'Erro',
        animate: false,
    },
};

export const DocumentList: React.FC<DocumentListProps> = ({
    documents,
    isAdmin,
    isLoading,
    onEdit,
}) => {
    const { showToast } = useToast();
    const deleteMutation = useDeleteDocument();
    const reprocessMutation = useReprocessDocument();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<TrainingDocument | null>(null);

    const handleDelete = async (id: string) => {
        try {
            await deleteMutation.mutateAsync(id);
            showToast('Documento removido', 'success');
            setConfirmDeleteId(null);
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Erro ao remover documento',
                'error'
            );
        }
    };

    const handleReprocess = async (id: string) => {
        try {
            await reprocessMutation.mutateAsync(id);
            showToast('Documento reprocessado', 'success');
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Erro ao reprocessar',
                'error'
            );
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando documentos...
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum documento de treinamento ainda.</p>
                <p className="text-sm">Adicione PDFs, textos ou pares Q&A acima.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-2">
                {documents.map((doc) => {
                    const TypeIcon = typeIcons[doc.type];
                    const status = statusConfig[doc.status];
                    const StatusIcon = status.icon;
                    const isDeleting = deleteMutation.isPending && confirmDeleteId === doc.id;
                    const isReprocessing = reprocessMutation.isPending && reprocessMutation.variables === doc.id;

                    return (
                        <div
                            key={doc.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/3 px-4 py-3"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2 rounded-lg ${status.bg}`}>
                                    <TypeIcon className={`h-4 w-4 ${status.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium text-slate-900 dark:text-white truncate">
                                        {doc.type === 'qa' ? `"${doc.title}"` : doc.title}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center gap-1">
                                            <StatusIcon
                                                className={`h-3 w-3 ${status.color} ${status.animate ? 'animate-spin' : ''}`}
                                            />
                                            {status.label}
                                        </span>
                                        {doc.status === 'processed' && (
                                            <span>{doc.chunkCount} chunks</span>
                                        )}
                                        {doc.status === 'error' && doc.errorMessage && (
                                            <span className="text-red-500 truncate max-w-[200px]" title={doc.errorMessage}>
                                                {doc.errorMessage}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {/* Preview button */}
                                <button
                                    type="button"
                                    onClick={() => setPreviewDoc(doc)}
                                    className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                                    title="Ver detalhes"
                                    aria-label="Ver detalhes"
                                >
                                    <Eye className="h-4 w-4" />
                                </button>

                                {/* Edit button (only for text and Q&A, and if admin) */}
                                {isAdmin && doc.type !== 'pdf' && onEdit && (
                                    <button
                                        type="button"
                                        onClick={() => onEdit(doc)}
                                        className="p-2 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/5"
                                        title="Editar"
                                        aria-label="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                )}

                                {/* Reprocess button (only for errors and if admin) */}
                                {isAdmin && doc.status === 'error' && (
                                    <button
                                        type="button"
                                        onClick={() => handleReprocess(doc.id)}
                                        disabled={isReprocessing}
                                        className="p-2 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
                                        title="Reprocessar"
                                        aria-label="Reprocessar"
                                    >
                                        {isReprocessing ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                    </button>
                                )}

                                {/* Delete button (only if admin) */}
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(doc.id)}
                                        disabled={isDeleting}
                                        className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
                                        title="Remover"
                                        aria-label="Remover"
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                title="Confirmar remoção"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-slate-600 dark:text-slate-300">
                        Tem certeza que deseja remover este documento? Os chunks associados
                        também serão removidos da base de conhecimento do agente.
                    </p>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                            disabled={deleteMutation.isPending}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                        >
                            {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Remover
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Preview Modal */}
            <Modal
                isOpen={!!previewDoc}
                onClose={() => setPreviewDoc(null)}
                title={previewDoc ? `${typeLabels[previewDoc.type]}: ${previewDoc.title}` : ''}
                size="lg"
            >
                {previewDoc && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Tipo:</span>
                                <span className="ml-2 text-slate-900 dark:text-white">
                                    {typeLabels[previewDoc.type]}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Status:</span>
                                <span className={`ml-2 ${statusConfig[previewDoc.status].color}`}>
                                    {statusConfig[previewDoc.status].label}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Chunks:</span>
                                <span className="ml-2 text-slate-900 dark:text-white">
                                    {previewDoc.chunkCount}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Tokens:</span>
                                <span className="ml-2 text-slate-900 dark:text-white">
                                    {previewDoc.totalTokens.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {previewDoc.type === 'qa' && (
                            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Pergunta:</div>
                                    <div className="text-slate-900 dark:text-white">{previewDoc.question}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Resposta:</div>
                                    <div className="text-slate-900 dark:text-white whitespace-pre-wrap">
                                        {previewDoc.answer}
                                    </div>
                                </div>
                            </div>
                        )}

                        {previewDoc.type === 'text' && previewDoc.content && (
                            <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Conteúdo:</div>
                                <div className="text-slate-900 dark:text-white whitespace-pre-wrap text-sm max-h-[300px] overflow-y-auto">
                                    {previewDoc.content}
                                </div>
                            </div>
                        )}

                        {previewDoc.status === 'error' && previewDoc.errorMessage && (
                            <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                                <div className="text-xs text-red-500 mb-1">Erro:</div>
                                <div className="text-red-600 dark:text-red-400 text-sm">
                                    {previewDoc.errorMessage}
                                </div>
                            </div>
                        )}

                        <div className="text-xs text-slate-400 dark:text-slate-500">
                            Criado em: {new Date(previewDoc.createdAt).toLocaleString('pt-BR')}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

'use client';

import React, { useState, useMemo } from 'react';
import { GraduationCap, FileText, MessageSquare, FileType, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTrainingDocuments } from './hooks';
import {
    TrainingStats,
    DocumentList,
    QAEditor,
    TextEditor,
    DocumentUpload,
    DocumentEditModal,
} from './components';
import type { TrainingDocument } from '@/lib/ai-training/types';

/**
 * Seção de Treinamento do Agente IA
 * Permite ao gestor adicionar documentos, textos e Q&A para a base de conhecimento
 */
export const AITrainingSection: React.FC = () => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

    const { data, isLoading, error } = useTrainingDocuments();

    const [showQAEditor, setShowQAEditor] = useState(false);
    const [showTextEditor, setShowTextEditor] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingDocument, setEditingDocument] = useState<TrainingDocument | null>(null);

    const documents = data?.documents ?? [];
    const stats = data?.stats ?? { totalDocuments: 0, totalChunks: 0, totalTokens: 0 };

    // Filter documents based on search query
    const filteredDocuments = useMemo(() => {
        if (!searchQuery.trim()) return documents;

        const query = searchQuery.toLowerCase();
        return documents.filter((doc) => {
            // Search in title
            if (doc.title.toLowerCase().includes(query)) return true;
            // Search in content (for text docs)
            if (doc.content?.toLowerCase().includes(query)) return true;
            // Search in question/answer (for Q&A docs)
            if (doc.question?.toLowerCase().includes(query)) return true;
            if (doc.answer?.toLowerCase().includes(query)) return true;
            // Search by type
            if (doc.type.toLowerCase().includes(query)) return true;
            return false;
        });
    }, [documents, searchQuery]);

    return (
        <div id="ai-training" className="scroll-mt-8">
            <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-6 mb-6">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" /> Treinamento do Agente
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Base de conhecimento para o agente de atendimento. Adicione documentos,
                            textos e perguntas frequentes.
                        </p>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                        {error instanceof Error ? error.message : 'Erro ao carregar documentos'}
                    </div>
                )}

                {/* Stats */}
                <div className="mb-6">
                    <TrainingStats stats={stats} isLoading={isLoading} />
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                    <div className="mb-6">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                            Adicionar Conteudo
                        </div>

                        {/* PDF Upload */}
                        <div className="mb-4">
                            <DocumentUpload disabled={!isAdmin} />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowQAEditor(true)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
                            >
                                <MessageSquare className="h-4 w-4" />
                                Q&A
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowTextEditor(true)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
                            >
                                <FileType className="h-4 w-4" />
                                Texto
                            </button>
                        </div>
                    </div>
                )}

                {/* Not Admin Warning */}
                {!isAdmin && (
                    <div className="mb-6 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        Apenas administradores podem adicionar ou remover documentos de treinamento.
                    </div>
                )}

                {/* Documents List */}
                <div>
                    <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Documentos ({filteredDocuments.length}{searchQuery && ` de ${documents.length}`})
                        </div>
                        {/* Search Input */}
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar documentos..."
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <DocumentList
                        documents={filteredDocuments}
                        isAdmin={isAdmin}
                        isLoading={isLoading}
                        onEdit={(doc) => setEditingDocument(doc)}
                    />
                </div>
            </div>

            {/* Modals */}
            <QAEditor isOpen={showQAEditor} onClose={() => setShowQAEditor(false)} />
            <TextEditor isOpen={showTextEditor} onClose={() => setShowTextEditor(false)} />
            <DocumentEditModal
                document={editingDocument}
                isOpen={!!editingDocument}
                onClose={() => setEditingDocument(null)}
            />
        </div>
    );
};

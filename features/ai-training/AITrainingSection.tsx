'use client';

import React, { useState } from 'react';
import { GraduationCap, FileText, MessageSquare, FileType } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTrainingDocuments } from './hooks';
import {
    TrainingStats,
    DocumentList,
    QAEditor,
    TextEditor,
    DocumentUpload,
} from './components';

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

    const documents = data?.documents ?? [];
    const stats = data?.stats ?? { totalDocuments: 0, totalChunks: 0, totalTokens: 0 };

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
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Documentos ({documents.length})
                    </div>
                    <DocumentList
                        documents={documents}
                        isAdmin={isAdmin}
                        isLoading={isLoading}
                    />
                </div>
            </div>

            {/* Modals */}
            <QAEditor isOpen={showQAEditor} onClose={() => setShowQAEditor(false)} />
            <TextEditor isOpen={showTextEditor} onClose={() => setShowTextEditor(false)} />
        </div>
    );
};

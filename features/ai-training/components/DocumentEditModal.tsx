'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useUpdateDocument } from '../hooks';
import { useToast } from '@/context/ToastContext';
import type { TrainingDocument } from '@/lib/ai-training/types';

interface DocumentEditModalProps {
    document: TrainingDocument | null;
    isOpen: boolean;
    onClose: () => void;
}

export const DocumentEditModal: React.FC<DocumentEditModalProps> = ({
    document,
    isOpen,
    onClose,
}) => {
    const { showToast } = useToast();
    const updateMutation = useUpdateDocument();

    // Text document fields
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // Q&A document fields
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');

    // Reset form when document changes
    useEffect(() => {
        if (document) {
            if (document.type === 'text') {
                setTitle(document.title || '');
                setContent(document.content || '');
            } else if (document.type === 'qa') {
                setQuestion(document.question || '');
                setAnswer(document.answer || '');
            }
        }
    }, [document]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!document) return;

        try {
            if (document.type === 'text') {
                await updateMutation.mutateAsync({
                    id: document.id,
                    data: { title, content },
                });
            } else if (document.type === 'qa') {
                await updateMutation.mutateAsync({
                    id: document.id,
                    data: { question, answer },
                });
            }

            showToast('Documento atualizado com sucesso', 'success');
            onClose();
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Erro ao atualizar documento',
                'error'
            );
        }
    };

    if (!document) return null;

    // PDFs cannot be edited
    if (document.type === 'pdf') {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Editar Documento" size="md">
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p>Documentos PDF não podem ser editados.</p>
                    <p className="text-sm mt-2">Remova e faça upload novamente se precisar atualizar.</p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Editar ${document.type === 'qa' ? 'Q&A' : 'Texto'}`}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {document.type === 'text' && (
                    <>
                        <div>
                            <label
                                htmlFor="edit-title"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                            >
                                Titulo
                            </label>
                            <input
                                id="edit-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Titulo do documento"
                                required
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="edit-content"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                            >
                                Conteudo
                            </label>
                            <textarea
                                id="edit-content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={10}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                placeholder="Conteudo do documento..."
                                required
                            />
                        </div>
                    </>
                )}

                {document.type === 'qa' && (
                    <>
                        <div>
                            <label
                                htmlFor="edit-question"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                            >
                                Pergunta
                            </label>
                            <textarea
                                id="edit-question"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                placeholder="Ex: Qual o horario de funcionamento?"
                                required
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="edit-answer"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                            >
                                Resposta
                            </label>
                            <textarea
                                id="edit-answer"
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                rows={6}
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                placeholder="Resposta detalhada..."
                                required
                            />
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Salvar
                    </button>
                </div>
            </form>
        </Modal>
    );
};

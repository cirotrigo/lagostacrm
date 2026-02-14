'use client';

import React, { useState } from 'react';
import { Loader2, MessageSquare, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCreateQADocument } from '../hooks';
import { useToast } from '@/context/ToastContext';

interface QAEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

export const QAEditor: React.FC<QAEditorProps> = ({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const createMutation = useCreateQADocument();
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!question.trim() || !answer.trim()) {
            showToast('Preencha pergunta e resposta', 'error');
            return;
        }

        try {
            await createMutation.mutateAsync({
                question: question.trim(),
                answer: answer.trim(),
            });
            showToast('Q&A adicionado com sucesso', 'success');
            setQuestion('');
            setAnswer('');
            onClose();
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Erro ao criar Q&A',
                'error'
            );
        }
    };

    const handleClose = () => {
        if (createMutation.isPending) return;
        setQuestion('');
        setAnswer('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Adicionar Pergunta e Resposta"
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="qa-question"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                    >
                        Pergunta
                    </label>
                    <input
                        id="qa-question"
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ex: O restaurante aceita reservas?"
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        disabled={createMutation.isPending}
                    />
                </div>

                <div>
                    <label
                        htmlFor="qa-answer"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                    >
                        Resposta
                    </label>
                    <textarea
                        id="qa-answer"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Sim, aceitamos reservas pelo WhatsApp ou telefone..."
                        rows={4}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-y"
                        disabled={createMutation.isPending}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={createMutation.isPending}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={createMutation.isPending || !question.trim() || !answer.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <MessageSquare className="h-4 w-4" />
                                Adicionar Q&A
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

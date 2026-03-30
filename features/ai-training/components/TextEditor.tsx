'use client';

import React, { useState } from 'react';
import { Loader2, FileType } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCreateTextDocument } from '../hooks';
import { useToast } from '@/context/ToastContext';

interface TextEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({ isOpen, onClose }) => {
    const { showToast } = useToast();
    const createMutation = useCreateTextDocument();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !content.trim()) {
            showToast('Preencha titulo e conteudo', 'error');
            return;
        }

        try {
            await createMutation.mutateAsync({
                title: title.trim(),
                content: content.trim(),
            });
            showToast('Texto adicionado com sucesso', 'success');
            setTitle('');
            setContent('');
            onClose();
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : 'Erro ao criar texto',
                'error'
            );
        }
    };

    const handleClose = () => {
        if (createMutation.isPending) return;
        setTitle('');
        setContent('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Adicionar Texto Livre"
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="text-title"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                    >
                        Titulo
                    </label>
                    <input
                        id="text-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Sobre o restaurante"
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        disabled={createMutation.isPending}
                    />
                </div>

                <div>
                    <label
                        htmlFor="text-content"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
                    >
                        Conteudo
                    </label>
                    <textarea
                        id="text-content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Cole ou digite o conteudo aqui..."
                        rows={8}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-y"
                        disabled={createMutation.isPending}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        O texto sera dividido automaticamente em chunks para processamento.
                    </p>
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
                        disabled={createMutation.isPending || !title.trim() || !content.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <FileType className="h-4 w-4" />
                                Adicionar Texto
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

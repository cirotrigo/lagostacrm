'use client';

import React, { useState } from 'react';
import { Lock, Send, Loader2 } from 'lucide-react';
import { useSendPrivateNote } from '../../hooks';

interface PrivateNoteInputProps {
    conversationId: number;
    onNoteSent?: () => void;
}

export const PrivateNoteInput: React.FC<PrivateNoteInputProps> = ({
    conversationId,
    onNoteSent,
}) => {
    const [content, setContent] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const { mutate: sendNote, isPending } = useSendPrivateNote();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || isPending) return;

        sendNote(
            { conversationId, content: content.trim() },
            {
                onSuccess: () => {
                    setContent('');
                    setIsExpanded(false);
                    onNoteSent?.();
                },
            }
        );
    };

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
                <Lock className="w-4 h-4" />
                <span>Nota privada</span>
            </button>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="w-full">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400">
                    <Lock className="w-4 h-4" />
                    <span className="text-xs font-medium">
                        Nota privada (visível apenas para agentes)
                    </span>
                </div>

                <div className="flex gap-2">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Escreva uma nota interna..."
                        className="flex-1 resize-none bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        rows={2}
                        disabled={isPending}
                        autoFocus
                    />

                    <div className="flex flex-col gap-1">
                        <button
                            type="submit"
                            disabled={!content.trim() || isPending}
                            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsExpanded(false);
                                setContent('');
                            }}
                            className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
};

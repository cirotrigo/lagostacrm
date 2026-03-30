'use client';

import React, { useState } from 'react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { useDealSummary } from '../../hooks/useDealSummary';
import { useBoard } from '@/lib/query/hooks/useBoardsQuery';
import { useMoveDealSimple } from '@/lib/query/hooks/useMoveDeal';
import { useCRM } from '@/context/CRMContext';
import { useToast } from '@/context/ToastContext';

interface DealStageSelectorProps {
    dealId: string;
}

/**
 * DealStageSelector - Dropdown to move a deal between stages
 *
 * Used in ContactInfoPanel to allow moving a deal without leaving
 * the messaging conversation view.
 */
export const DealStageSelector: React.FC<DealStageSelectorProps> = ({ dealId }) => {
    const { addToast } = useToast();
    const { lifecycleStages } = useCRM();

    // Fetch deal summary to get board_id and current stage_id
    const { data: dealSummary, isLoading: isLoadingDeal } = useDealSummary(dealId);

    // Fetch board with stages
    const { data: board, isLoading: isLoadingBoard } = useBoard(dealSummary?.board_id);

    // Hook to move the deal
    const { moveDeal, isMoving } = useMoveDealSimple(board ?? null, lifecycleStages);

    const [isOpen, setIsOpen] = useState(false);

    // Loading state
    if (isLoadingDeal || isLoadingBoard) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando...</span>
            </div>
        );
    }

    // No deal or board found
    if (!dealSummary || !board) {
        return (
            <div className="text-sm text-slate-500 italic">
                Estágio não disponível
            </div>
        );
    }

    const currentStage = board.stages.find(s => s.id === dealSummary.stage_id);
    const currentStageLabel = currentStage?.label || 'Desconhecido';
    const currentStageColor = currentStage?.color || 'bg-slate-500';

    const handleStageSelect = async (stageId: string) => {
        if (stageId === dealSummary.stage_id || !board) {
            setIsOpen(false);
            return;
        }

        try {
            // Create a minimal deal object for the hook
            const dealForMove = {
                id: dealSummary.id,
                title: dealSummary.title,
                value: dealSummary.value,
                status: dealSummary.stage_id,
                boardId: dealSummary.board_id,
                isWon: false,
                isLost: false,
            };

            await moveDeal(dealForMove as any, stageId);
            addToast(`Deal movido para "${board.stages.find(s => s.id === stageId)?.label}"`, 'success');
        } catch (error) {
            console.error('[DealStageSelector] Failed to move deal:', error);
            addToast('Erro ao mover o deal', 'error');
        }

        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* Trigger button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isMoving}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isOpen
                        ? 'bg-slate-100 dark:bg-white/10'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                } ${isMoving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <span
                    className={`w-2.5 h-2.5 rounded-full ${currentStageColor}`}
                />
                <span className="text-slate-700 dark:text-slate-300">
                    {currentStageLabel}
                </span>
                {isMoving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <>
                    {/* Backdrop to close dropdown */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown content */}
                    <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 py-1 overflow-hidden">
                        <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                            Mover para
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {board.stages.map((stage) => {
                                const isCurrentStage = stage.id === dealSummary.stage_id;

                                return (
                                    <button
                                        key={stage.id}
                                        onClick={() => handleStageSelect(stage.id)}
                                        disabled={isCurrentStage}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                            isCurrentStage
                                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <span
                                            className={`w-2.5 h-2.5 rounded-full ${stage.color}`}
                                        />
                                        <span className="flex-1">{stage.label}</span>
                                        {isCurrentStage && (
                                            <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

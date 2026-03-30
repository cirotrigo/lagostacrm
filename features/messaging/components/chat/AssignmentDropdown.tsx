'use client';

import React, { useState } from 'react';
import { User, UserX, ChevronDown, Loader2, Check } from 'lucide-react';
import { useAgents, useAssignConversation } from '../../hooks';
import type { ChatwootAgent } from '@/lib/chatwoot';

interface AssignmentDropdownProps {
    conversationId: number;
    currentAgentId?: number | null;
    currentAgentName?: string | null;
    inboxId?: number;
    onAssigned?: (agent: ChatwootAgent | null) => void;
}

export const AssignmentDropdown: React.FC<AssignmentDropdownProps> = ({
    conversationId,
    currentAgentId,
    currentAgentName,
    inboxId,
    onAssigned,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const { data: agents, isLoading: isLoadingAgents } = useAgents(inboxId, isOpen);
    const { mutate: assign, isPending: isAssigning } = useAssignConversation();

    const handleAssign = (agentId: number | null) => {
        assign(
            { conversationId, agentId },
            {
                onSuccess: () => {
                    setIsOpen(false);
                    if (onAssigned) {
                        const selectedAgent = agentId
                            ? agents?.find((a) => a.id === agentId) || null
                            : null;
                        onAssigned(selectedAgent);
                    }
                },
            }
        );
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isAssigning}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
                {isAssigning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : currentAgentId ? (
                    <User className="w-4 h-4 text-primary-500" />
                ) : (
                    <UserX className="w-4 h-4 text-slate-400" />
                )}
                <span className="max-w-[120px] truncate">
                    {currentAgentName || 'Não atribuído'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 z-20">
                        <div className="p-2">
                            <p className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                Atribuir a
                            </p>

                            {isLoadingAgents ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {/* Unassign option */}
                                    <button
                                        onClick={() => handleAssign(null)}
                                        className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-white/5 transition-colors ${
                                            !currentAgentId
                                                ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                                : 'text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <UserX className="w-4 h-4" />
                                        <span className="flex-1 text-left">Não atribuído</span>
                                        {!currentAgentId && <Check className="w-4 h-4" />}
                                    </button>

                                    {/* Agent list */}
                                    {agents?.map((agent) => (
                                        <button
                                            key={agent.id}
                                            onClick={() => handleAssign(agent.id)}
                                            className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-white/5 transition-colors ${
                                                currentAgentId === agent.id
                                                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                                    : 'text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {agent.thumbnail ? (
                                                <img
                                                    src={agent.thumbnail}
                                                    alt={agent.name}
                                                    className="w-5 h-5 rounded-full"
                                                />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                                                    <User className="w-3 h-3 text-slate-500" />
                                                </div>
                                            )}
                                            <span className="flex-1 text-left truncate">
                                                {agent.name}
                                            </span>
                                            {/* Availability indicator */}
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    agent.availability_status === 'online'
                                                        ? 'bg-green-500'
                                                        : agent.availability_status === 'busy'
                                                        ? 'bg-yellow-500'
                                                        : 'bg-slate-300 dark:bg-slate-600'
                                                }`}
                                            />
                                            {currentAgentId === agent.id && (
                                                <Check className="w-4 h-4" />
                                            )}
                                        </button>
                                    ))}

                                    {agents?.length === 0 && (
                                        <p className="px-2 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                                            Nenhum agente disponível
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

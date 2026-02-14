'use client';

import React from 'react';
import {
    CheckCircle,
    Circle,
    Clock,
    MoreVertical,
    ExternalLink,
    Phone,
    Mail,
} from 'lucide-react';
import { AssignmentDropdown } from './AssignmentDropdown';
import { useToggleStatus } from '../../hooks';
import type { ConversationStatus } from '@/lib/chatwoot';

interface ChatConversationHeaderProps {
    conversationId: number;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    contactAvatar?: string | null;
    status: ConversationStatus;
    assignedAgentId?: number | null;
    assignedAgentName?: string | null;
    inboxId?: number;
    chatwootUrl?: string | null;
}

const statusConfig: Record<
    ConversationStatus,
    { label: string; icon: React.ElementType; color: string }
> = {
    open: {
        label: 'Aberta',
        icon: Circle,
        color: 'text-green-500',
    },
    pending: {
        label: 'Pendente',
        icon: Clock,
        color: 'text-yellow-500',
    },
    resolved: {
        label: 'Resolvida',
        icon: CheckCircle,
        color: 'text-slate-400',
    },
    snoozed: {
        label: 'Adiada',
        icon: Clock,
        color: 'text-blue-500',
    },
};

export const ChatConversationHeader: React.FC<ChatConversationHeaderProps> = ({
    conversationId,
    contactName,
    contactPhone,
    contactEmail,
    contactAvatar,
    status,
    assignedAgentId,
    assignedAgentName,
    inboxId,
    chatwootUrl,
}) => {
    const { mutate: updateStatus, isPending: isUpdating } = useToggleStatus();
    const [showStatusMenu, setShowStatusMenu] = React.useState(false);

    const currentStatus = statusConfig[status] || statusConfig.open;
    const StatusIcon = currentStatus.icon;

    const handleStatusChange = (newStatus: ConversationStatus) => {
        updateStatus({ conversationId, status: newStatus });
        setShowStatusMenu(false);
    };

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10">
            {/* Contact Info */}
            <div className="flex items-center gap-3">
                {/* Avatar */}
                {contactAvatar ? (
                    <img
                        src={contactAvatar}
                        alt={contactName || 'Contact'}
                        className="w-10 h-10 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                            {contactName?.charAt(0).toUpperCase() || '?'}
                        </span>
                    </div>
                )}

                {/* Name and contact info */}
                <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                        {contactName || 'Contato desconhecido'}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        {contactPhone && (
                            <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {contactPhone}
                            </span>
                        )}
                        {contactEmail && (
                            <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {contactEmail}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Status */}
                <div className="relative">
                    <button
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        disabled={isUpdating}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            status === 'resolved'
                                ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10'
                                : status === 'pending'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        }`}
                    >
                        <StatusIcon className={`w-4 h-4 ${currentStatus.color}`} />
                        <span>{currentStatus.label}</span>
                    </button>

                    {showStatusMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowStatusMenu(false)}
                            />
                            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 z-20 py-1">
                                {(Object.keys(statusConfig) as ConversationStatus[]).map(
                                    (statusKey) => {
                                        const config = statusConfig[statusKey];
                                        const Icon = config.icon;
                                        return (
                                            <button
                                                key={statusKey}
                                                onClick={() => handleStatusChange(statusKey)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5 ${
                                                    status === statusKey
                                                        ? 'bg-slate-50 dark:bg-white/5'
                                                        : ''
                                                }`}
                                            >
                                                <Icon className={`w-4 h-4 ${config.color}`} />
                                                <span>{config.label}</span>
                                            </button>
                                        );
                                    }
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Assignment */}
                <AssignmentDropdown
                    conversationId={conversationId}
                    currentAgentId={assignedAgentId}
                    currentAgentName={assignedAgentName}
                    inboxId={inboxId}
                />

                {/* External link to Chatwoot */}
                {chatwootUrl && (
                    <a
                        href={chatwootUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                        title="Abrir no Chatwoot"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                )}

                {/* More options */}
                <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

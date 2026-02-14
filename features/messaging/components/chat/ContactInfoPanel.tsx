'use client';

import React from 'react';
import {
    User,
    Phone,
    Mail,
    Briefcase,
    DollarSign,
    ExternalLink,
    X,
} from 'lucide-react';
import { AssignmentDropdown } from './AssignmentDropdown';
import { PrivateNoteInput } from './PrivateNoteInput';
import { DealStageSelector } from './DealStageSelector';
import type { WhatsAppConversationView, WhatsAppConversationStatus } from '@/types/types';

interface ContactInfoPanelProps {
    conversation: WhatsAppConversationView;
    onClose?: () => void;
    onStatusChange?: (status: WhatsAppConversationStatus) => void;
}

const statusConfig: Record<
    WhatsAppConversationStatus,
    { label: string; color: string; bg: string }
> = {
    open: {
        label: 'Aberta',
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
    },
    pending: {
        label: 'Pendente',
        color: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    resolved: {
        label: 'Resolvida',
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-900/30',
    },
    archived: {
        label: 'Arquivada',
        color: 'text-slate-500 dark:text-slate-500',
        bg: 'bg-slate-50 dark:bg-slate-900/20',
    },
};

export const ContactInfoPanel: React.FC<ContactInfoPanelProps> = ({
    conversation,
    onClose,
    onStatusChange,
}) => {
    const status = statusConfig[conversation.status] || statusConfig.open;
    const conversationId = parseInt(conversation.id, 10);

    // Format currency
    const formatCurrency = (value: number | null) => {
        if (value === null) return null;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                    Informações
                </h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Contact Avatar & Name */}
                <div className="p-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex flex-col items-center text-center">
                        {conversation.contact_avatar ? (
                            <img
                                src={conversation.contact_avatar}
                                alt={conversation.contact_name || 'Contato'}
                                className="w-20 h-20 rounded-full object-cover mb-3"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-3">
                                <span className="text-2xl font-semibold text-primary-600 dark:text-primary-400">
                                    {conversation.contact_name?.charAt(0).toUpperCase() || '?'}
                                </span>
                            </div>
                        )}
                        <h4 className="font-semibold text-lg text-slate-900 dark:text-white">
                            {conversation.contact_name || 'Contato desconhecido'}
                        </h4>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${status.bg} ${status.color}`}>
                            {status.label}
                        </span>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
                    <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Contato
                    </h5>

                    {conversation.contact_phone && (
                        <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">
                                {conversation.contact_phone}
                            </span>
                        </div>
                    )}

                    {conversation.contact_email && (
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">
                                {conversation.contact_email}
                            </span>
                        </div>
                    )}

                    {conversation.contact_id && (
                        <a
                            href={`/contacts?id=${conversation.contact_id}`}
                            className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                        >
                            <User className="w-4 h-4" />
                            <span>Ver contato no CRM</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>

                {/* Deal Info (if linked) */}
                {conversation.deal_id && (
                    <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
                        <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Negócio vinculado
                        </h5>

                        <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 space-y-2">
                            {conversation.deal_title && (
                                <div className="flex items-start gap-2">
                                    <Briefcase className="w-4 h-4 text-slate-400 mt-0.5" />
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                                        {conversation.deal_title}
                                    </span>
                                </div>
                            )}

                            {conversation.deal_value !== null && (
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        {formatCurrency(conversation.deal_value)}
                                    </span>
                                </div>
                            )}

                            {/* Deal Stage Selector - allows moving deal between stages */}
                            <div className="flex items-center gap-2">
                                <DealStageSelector dealId={conversation.deal_id!} />
                            </div>

                            <a
                                href={`/pipeline?dealId=${conversation.deal_id}`}
                                className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline mt-2"
                            >
                                <span>Abrir deal</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                )}

                {/* Assignment */}
                <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
                    <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Atribuição
                    </h5>
                    <AssignmentDropdown
                        conversationId={conversationId}
                        currentAgentId={null}
                        currentAgentName={conversation.assigned_to || null}
                    />
                </div>

                {/* Quick Actions */}
                {onStatusChange && (
                    <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-3">
                        <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Ações rápidas
                        </h5>
                        <div className="flex flex-wrap gap-2">
                            {conversation.status !== 'resolved' && (
                                <button
                                    onClick={() => onStatusChange('resolved')}
                                    className="px-3 py-1.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                >
                                    Resolver
                                </button>
                            )}
                            {conversation.status !== 'pending' && (
                                <button
                                    onClick={() => onStatusChange('pending')}
                                    className="px-3 py-1.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                                >
                                    Pendente
                                </button>
                            )}
                            {conversation.status !== 'open' && (
                                <button
                                    onClick={() => onStatusChange('open')}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                    Reabrir
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Private Notes */}
                <div className="p-4 space-y-3">
                    <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Nota privada
                    </h5>
                    <PrivateNoteInput conversationId={conversationId} />
                </div>
            </div>
        </div>
    );
};

'use client';

import { useConversationLinks } from '../hooks';
import type { ConversationLink } from '@/lib/chatwoot';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, MessageCircle, Loader2 } from 'lucide-react';

interface ConversationTimelineProps {
    contactId?: string;
    dealId?: string;
    className?: string;
    variant?: 'light' | 'dark';
}

/**
 * ConversationTimeline - Displays a read-only timeline of Chatwoot conversations
 *
 * Used in contact and deal views to show conversation history.
 * Includes a link to open the full conversation in Chatwoot.
 *
 * @example
 * ```tsx
 * // In a contact view
 * <ConversationTimeline contactId={contact.id} />
 *
 * // In a deal view (dark mode for cockpit)
 * <ConversationTimeline dealId={deal.id} variant="dark" />
 * ```
 */
export function ConversationTimeline({
    contactId,
    dealId,
    className = '',
    variant = 'light',
}: ConversationTimelineProps) {
    const { data: links, isLoading, error } = useConversationLinks({
        contactId,
        dealId,
    });

    const isDark = variant === 'dark';

    if (isLoading) {
        return (
            <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
                <Loader2 className={`h-6 w-6 animate-spin ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Carregando conversas...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`rounded-lg border p-4 ${className} ${
                isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-200 bg-red-50'
            }`}>
                <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    Erro ao carregar conversas
                </p>
            </div>
        );
    }

    if (!links?.length) {
        return (
            <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
                <MessageCircle className={`h-10 w-10 ${isDark ? 'text-slate-500' : 'text-gray-300'}`} />
                <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    Nenhuma conversa vinculada
                </p>
                <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    As conversas do Chatwoot aparecerao aqui
                </p>
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {links.map((link) => (
                <ConversationCard key={link.id} link={link} variant={variant} />
            ))}
        </div>
    );
}

interface ConversationCardProps {
    link: ConversationLink;
    variant?: 'light' | 'dark';
}

function ConversationCard({ link, variant = 'light' }: ConversationCardProps) {
    const isDark = variant === 'dark';

    const statusColors: Record<string, { light: string; dark: string }> = {
        open: {
            light: 'bg-green-100 text-green-700',
            dark: 'bg-green-500/20 text-green-400',
        },
        resolved: {
            light: 'bg-gray-100 text-gray-600',
            dark: 'bg-slate-500/20 text-slate-400',
        },
        pending: {
            light: 'bg-yellow-100 text-yellow-700',
            dark: 'bg-yellow-500/20 text-yellow-400',
        },
    };

    const statusLabels: Record<string, string> = {
        open: 'Aberta',
        resolved: 'Resolvida',
        pending: 'Pendente',
    };

    const timeAgo = link.lastMessageAt
        ? formatDistanceToNow(new Date(link.lastMessageAt), {
            addSuffix: true,
            locale: ptBR,
        })
        : 'Sem mensagens';

    const cardStyles = isDark
        ? 'rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10'
        : 'rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm';

    const statusStyle = statusColors[link.status]?.[isDark ? 'dark' : 'light'] || statusColors.pending[isDark ? 'dark' : 'light'];

    return (
        <div className={cardStyles}>
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}
                        >
                            {statusLabels[link.status] || link.status}
                        </span>
                        {link.unreadCount > 0 && (
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-medium text-white">
                                {link.unreadCount}
                            </span>
                        )}
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                            {timeAgo}
                        </span>
                    </div>

                    {link.lastMessagePreview && (
                        <p className={`mt-2 truncate text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                            {link.lastMessageSender === 'customer' ? (
                                <span className="font-medium">Cliente: </span>
                            ) : (
                                <span className="font-medium">Agente: </span>
                            )}
                            {link.lastMessagePreview}
                        </p>
                    )}
                </div>

                {link.chatwootUrl && (
                    <a
                        href={link.chatwootUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`ml-4 flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                            isDark
                                ? 'border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                    </a>
                )}
            </div>
        </div>
    );
}

export default ConversationTimeline;

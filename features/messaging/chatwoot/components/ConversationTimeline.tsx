'use client';

import { useConversationLinks } from '../hooks';
import type { ConversationLink } from '@/lib/chatwoot';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationTimelineProps {
    contactId?: string;
    dealId?: string;
    className?: string;
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
 * // In a deal view
 * <ConversationTimeline dealId={deal.id} />
 * ```
 */
export function ConversationTimeline({
    contactId,
    dealId,
    className = '',
}: ConversationTimelineProps) {
    const { data: links, isLoading, error } = useConversationLinks({
        contactId,
        dealId,
    });

    if (isLoading) {
        return (
            <div className={`space-y-3 ${className}`}>
                {[1, 2].map((i) => (
                    <div
                        key={i}
                        className="animate-pulse rounded-lg border border-gray-200 p-4"
                    >
                        <div className="h-4 w-1/3 rounded bg-gray-200" />
                        <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
                <p className="text-sm text-red-600">
                    Erro ao carregar conversas
                </p>
            </div>
        );
    }

    if (!links?.length) {
        return (
            <div className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}>
                <p className="text-sm text-gray-500">
                    Nenhuma conversa encontrada
                </p>
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {links.map((link) => (
                <ConversationCard key={link.id} link={link} />
            ))}
        </div>
    );
}

interface ConversationCardProps {
    link: ConversationLink;
}

function ConversationCard({ link }: ConversationCardProps) {
    const statusColors: Record<string, string> = {
        open: 'bg-green-100 text-green-700',
        resolved: 'bg-gray-100 text-gray-600',
        pending: 'bg-yellow-100 text-yellow-700',
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

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[link.status]}`}
                        >
                            {statusLabels[link.status]}
                        </span>
                        {link.unreadCount > 0 && (
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-medium text-white">
                                {link.unreadCount}
                            </span>
                        )}
                        <span className="text-xs text-gray-400">{timeAgo}</span>
                    </div>

                    {link.lastMessagePreview && (
                        <p className="mt-2 truncate text-sm text-gray-600">
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
                        className="ml-4 flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
                    >
                        Abrir
                    </a>
                )}
            </div>
        </div>
    );
}

export default ConversationTimeline;
